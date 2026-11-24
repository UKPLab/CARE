/**
 * Performance tier detection ("perf tier") for slow machines.
 *
 * Decides whether this browser is fast enough for the full visual layer and publishes the
 * answer as `<html data-perf="high|medium|low">`. CSS (see global.css, section "Performance
 * tiers") and JS (`perf.tier`, `this.$perf`) then drop the expensive extras on weaker devices:
 * infinite decorative animations, backdrop blur, skeleton shimmer, long transitions, view
 * transitions, table overscan.
 *
 * Signals, cheapest first:
 *  1. Static hints, read once: navigator.hardwareConcurrency (CPU threads),
 *     navigator.deviceMemory (GB, Chromium only), navigator.connection.saveData.
 *  2. CPU micro-benchmark: a fixed JS workload of ~1 ms on a current desktop, repeated every
 *     30 s while the tab is visible, in idle time. It scales with real CPU speed and with Chrome
 *     DevTools CPU throttling (4x -> ~4 ms, 8x -> ~8 ms, 20x -> ~20 ms), which the static
 *     hints cannot see. Cost: 2 runs per 30 s, i.e. < 0.1 % CPU on a normal machine.
 *  3. Long tasks (Chromium only, passive PerformanceObserver): share of the last interval the
 *     main thread was blocked by tasks > 50 ms. A machine that keeps freezing is slow, whatever
 *     the benchmark says.
 *
 * Hysteresis: the tier drops after 2 bad probes in a row and rises only after 3 good ones, so a
 * single GC pause or a heavy page load does not make the UI flip back and forth.
 *
 * Manual override (also handy for testing), in the console:
 *   carePerf.set("low")     // or "medium" | "high" | "auto"  (stored in localStorage)
 *   carePerf.debug(true)    // FPS / tier overlay in the bottom-left corner
 *   carePerf.state          // current numbers
 * or with the URL query `?perf=low` / `?perfDebug=1`.
 */
import {reactive} from "vue";

const MODE_KEY = "care.perfMode";
const DEBUG_KEY = "care.perfDebug";
// Last measured tier, so the next page load starts in it before the first paint instead of
// rendering the full animated UI for the moment until the first benchmark has run.
const LAST_TIER_KEY = "care.perfLastTier";
const MODES = ["auto", "high", "medium", "low"];
const TIERS = ["low", "medium", "high"];

const PROBE_INTERVAL_MS = 30 * 1000;
const BENCH_ITERATIONS = 100000;
// Benchmark thresholds (ms per run, best of 2). Calibrated on the workload below:
// ~0.5-1 ms on a current desktop, ~2 ms on an average office laptop.
const BENCH_MEDIUM_MS = 3;
const BENCH_LOW_MS = 7;
// Share of wall time spent in long tasks during the last interval.
const LONGTASK_MEDIUM = 0.15;
const LONGTASK_LOW = 0.35;
const DOWNGRADE_AFTER = 2;
const UPGRADE_AFTER = 3;

export const perf = reactive({
  /** Effective tier, what CSS and JS should follow. */
  tier: "high",
  /** "auto" or a forced tier. */
  mode: "auto",
  /** Tier from the static hints only. */
  hintTier: "high",
  cores: null,
  memoryGb: null,
  saveData: false,
  reducedMotion: false,
  /** Last benchmark result in ms (best of 2 runs). */
  benchmarkMs: null,
  /** Share of the last interval spent in long tasks (Chromium only, else null). */
  longTaskRatio: null,
  /** Frames per second, only measured while the debug overlay is on. */
  fps: null,
  /** Why the current tier was chosen. */
  reason: "",
});

let started = false;
let probeTimer = null;
let benchSink = 0;
let longTaskTotal = 0;
let longTaskSince = 0;
let longTaskObserver = null;
let pendingTier = null;
let pendingCount = 0;
let overlay = null;
let overlayRaf = null;

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // private mode / blocked storage: the setting just does not persist
  }
}

function tierIndex(tier) {
  return TIERS.indexOf(tier);
}

function minTier(a, b) {
  return tierIndex(a) <= tierIndex(b) ? a : b;
}

function readHints() {
  const nav = typeof navigator !== "undefined" ? navigator : {};
  perf.cores = Number(nav.hardwareConcurrency) || null;
  perf.memoryGb = Number(nav.deviceMemory) || null;
  perf.saveData = !!nav.connection?.saveData;
  perf.reducedMotion = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  let tier = "high";
  const reasons = [];
  if (perf.saveData) {
    tier = "low";
    reasons.push("save-data");
  }
  if (perf.cores != null) {
    if (perf.cores <= 2) {
      tier = minTier(tier, "low");
      reasons.push(`${perf.cores} cores`);
    } else if (perf.cores <= 4) {
      tier = minTier(tier, "medium");
      reasons.push(`${perf.cores} cores`);
    }
  }
  if (perf.memoryGb != null) {
    if (perf.memoryGb <= 2) {
      tier = minTier(tier, "low");
      reasons.push(`${perf.memoryGb} GB`);
    } else if (perf.memoryGb <= 4) {
      tier = minTier(tier, "medium");
      reasons.push(`${perf.memoryGb} GB`);
    }
  }
  perf.hintTier = tier;
  return reasons.join(", ");
}

/**
 * Fixed mixed workload (integer math, array access, small allocations), roughly what a
 * render pass does. Returns the run time in ms.
 * @param {number} iterations
 * @returns {number}
 */
function benchmarkRun(iterations) {
  const start = performance.now();
  const buf = new Array(64).fill(0);
  let acc = 0;
  for (let i = 0; i < iterations; i += 1) {
    const v = (i * 2654435761) >>> 0;
    buf[i & 63] = v;
    acc += Math.sqrt(v) + ((buf[(i * 7) & 63] | 0) % 13);
    const o = {k: i, v: acc};
    acc += o.k & 1;
  }
  benchSink = acc;
  return performance.now() - start;
}

function whenIdle(fn) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(fn, {timeout: 2000});
  } else {
    setTimeout(fn, 0);
  }
}

function tierFromBenchmark(ms) {
  if (ms >= BENCH_LOW_MS) return "low";
  if (ms >= BENCH_MEDIUM_MS) return "medium";
  return "high";
}

function tierFromLongTasks(ratio) {
  if (ratio == null) return "high";
  if (ratio >= LONGTASK_LOW) return "low";
  if (ratio >= LONGTASK_MEDIUM) return "medium";
  return "high";
}

function applyTier(tier, reason) {
  perf.reason = reason;
  if (perf.tier === tier && document.documentElement.dataset.perf === tier) return;
  perf.tier = tier;
  document.documentElement.dataset.perf = tier;
}

function rememberTier(tier) {
  if (perf.mode === "auto") storageSet(LAST_TIER_KEY, tier);
}

/**
 * Feed one measured tier into the hysteresis. First probe of a page load applies directly.
 * @param {string} measured
 * @param {string} reason
 * @param {boolean} immediate
 */
function proposeTier(measured, reason, immediate = false) {
  if (perf.mode !== "auto") return;
  if (immediate || measured === perf.tier) {
    pendingTier = null;
    pendingCount = 0;
    applyTier(measured, reason);
    rememberTier(measured);
    return;
  }
  if (pendingTier !== measured) {
    pendingTier = measured;
    pendingCount = 0;
  }
  pendingCount += 1;
  const needed = tierIndex(measured) < tierIndex(perf.tier) ? DOWNGRADE_AFTER : UPGRADE_AFTER;
  if (pendingCount >= needed) {
    pendingTier = null;
    pendingCount = 0;
    applyTier(measured, reason);
    rememberTier(measured);
  }
}

function takeLongTaskRatio() {
  if (!longTaskObserver) return null;
  const now = performance.now();
  const elapsed = now - longTaskSince;
  const ratio = elapsed > 0 ? Math.min(1, longTaskTotal / elapsed) : 0;
  longTaskTotal = 0;
  longTaskSince = now;
  return ratio;
}

/**
 * One probe: a few benchmark runs, each in its own idle task (a few short tasks instead of one
 * long one on a slow machine), best run counts. The first probe of a page load does a small
 * warm-up run and one extra run: the first, not yet JIT-optimised runs are 10-30x slower.
 * @param {boolean} first
 */
function probe(first = false) {
  if (document.hidden) return; // a background tab is throttled by the browser anyway
  const runs = first ? 3 : 2;
  let best = Infinity;
  let done = 0;
  const step = () => {
    best = Math.min(best, benchmarkRun(BENCH_ITERATIONS));
    done += 1;
    if (done < runs) {
      whenIdle(step);
      return;
    }
    finishProbe(best, first);
  };
  whenIdle(() => {
    if (first) benchmarkRun(2000);
    whenIdle(step);
  });
}

function finishProbe(ms, first) {
  perf.benchmarkMs = Math.round(ms * 100) / 100;
  perf.longTaskRatio = takeLongTaskRatio();
  const benchTier = tierFromBenchmark(ms);
  // Page start-up is all long tasks by nature; judge long tasks from the second probe on.
  const taskTier = first ? "high" : tierFromLongTasks(perf.longTaskRatio);
  const measured = minTier(perf.hintTier, minTier(benchTier, taskTier));
  const reason = [
    `bench ${perf.benchmarkMs} ms`,
    perf.longTaskRatio != null ? `long tasks ${Math.round(perf.longTaskRatio * 100)}%` : null,
    perf.hintTier !== "high" ? `hints: ${perf.hintTier}` : null,
  ].filter(Boolean).join(", ");
  proposeTier(measured, reason, first);
  updateOverlay();
}

function startLongTaskObserver() {
  if (typeof PerformanceObserver === "undefined") return;
  if (!PerformanceObserver.supportedEntryTypes?.includes("longtask")) return;
  try {
    longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTaskTotal += entry.duration;
    });
    longTaskObserver.observe({type: "longtask"});
    longTaskSince = performance.now();
  } catch {
    longTaskObserver = null;
  }
}

function schedule() {
  clearInterval(probeTimer);
  probeTimer = null;
  if (perf.mode !== "auto") return;
  probeTimer = setInterval(() => probe(false), PROBE_INTERVAL_MS);
}

function onVisibility() {
  if (perf.mode !== "auto") return;
  if (document.hidden) {
    clearInterval(probeTimer);
    probeTimer = null;
  } else {
    // Long tasks while hidden do not count; restart the window.
    longTaskTotal = 0;
    longTaskSince = performance.now();
    schedule();
  }
}

/**
 * Force a tier or go back to automatic detection.
 * @param {"auto"|"high"|"medium"|"low"} mode
 */
export function setPerfMode(mode) {
  const next = MODES.includes(mode) ? mode : "auto";
  perf.mode = next;
  storageSet(MODE_KEY, next === "auto" ? null : next);
  pendingTier = null;
  pendingCount = 0;
  if (next === "auto") {
    readHints();
    applyTier(perf.hintTier, "hints");
    probe(true);
  } else {
    applyTier(next, "forced");
  }
  schedule();
  updateOverlay();
}

// ---------------------------------------------------------------- debug overlay (FPS meter)

function updateOverlay() {
  if (!overlay) return;
  const lt = perf.longTaskRatio != null ? `${Math.round(perf.longTaskRatio * 100)}%` : "n/a";
  overlay.textContent =
    `${perf.fps ?? "–"} fps · tier ${perf.tier}${perf.mode !== "auto" ? " (forced)" : ""}\n` +
    `bench ${perf.benchmarkMs ?? "–"} ms · long tasks ${lt}\n` +
    `${perf.cores ?? "?"} cores · ${perf.memoryGb ?? "?"} GB`;
}

/**
 * Small fixed FPS / tier readout. Plain DOM, no Vue, so it does not measure itself.
 * The rAF loop only runs while it is shown.
 * @param {boolean} on
 */
export function setPerfDebug(on) {
  storageSet(DEBUG_KEY, on ? "1" : null);
  if (!on) {
    cancelAnimationFrame(overlayRaf);
    overlayRaf = null;
    overlay?.remove();
    overlay = null;
    perf.fps = null;
    return;
  }
  if (overlay) return;
  overlay = document.createElement("div");
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.cssText = [
    "position:fixed", "left:8px", "bottom:8px", "z-index:2147483647",
    "padding:4px 8px", "border-radius:6px", "pointer-events:none",
    "font:11px/1.35 ui-monospace,monospace", "white-space:pre",
    "background:rgba(0,0,0,.75)", "color:#9f9",
  ].join(";");
  document.body.appendChild(overlay);
  let frames = 0;
  let since = performance.now();
  const loop = (now) => {
    frames += 1;
    if (now - since >= 500) {
      perf.fps = Math.round((frames * 1000) / (now - since));
      frames = 0;
      since = now;
      updateOverlay();
    }
    overlayRaf = requestAnimationFrame(loop);
  };
  overlayRaf = requestAnimationFrame(loop);
  updateOverlay();
}

/**
 * Start detection. Safe to call more than once.
 */
export function startPerformanceMonitor() {
  if (started || typeof window === "undefined") return;
  started = true;

  const params = new URLSearchParams(window.location.search);
  const urlMode = params.get("perf");
  if (MODES.includes(urlMode)) storageSet(MODE_KEY, urlMode === "auto" ? null : urlMode);
  if (params.has("perfDebug")) storageSet(DEBUG_KEY, params.get("perfDebug") === "0" ? null : "1");

  const hintReason = readHints();
  const stored = storageGet(MODE_KEY);
  perf.mode = MODES.includes(stored) ? stored : "auto";

  if (perf.mode === "auto") {
    // Before the first paint: the tier measured last time (capped by the hardware hints), else
    // the hints alone. The real measurement follows once the page is idle.
    const last = storageGet(LAST_TIER_KEY);
    if (TIERS.includes(last)) {
      applyTier(minTier(last, perf.hintTier), `last measured: ${last}`);
    } else {
      applyTier(perf.hintTier, hintReason ? `hints: ${hintReason}` : "hints");
    }
    startLongTaskObserver();
    probe(true);
    schedule();
  } else {
    applyTier(perf.mode, "forced");
  }
  document.addEventListener("visibilitychange", onVisibility);

  window.carePerf = {
    state: perf,
    set: setPerfMode,
    debug: (on = true) => setPerfDebug(on),
    benchmark: () => benchmarkRun(BENCH_ITERATIONS),
  };

  if (storageGet(DEBUG_KEY) === "1") {
    if (document.body) setPerfDebug(true);
    else window.addEventListener("DOMContentLoaded", () => setPerfDebug(true), {once: true});
  }
  // Keep the sink observable so the optimiser cannot drop the benchmark loop.
  window.carePerf._sink = () => benchSink;
}

/**
 * Current tier, for code outside components.
 * @returns {"high"|"medium"|"low"}
 */
export function perfTier() {
  return perf.tier;
}

export function isLowPerf() {
  return perf.tier === "low";
}

/**
 * True when motion should be skipped: the user asked for reduced motion, or this device is in
 * the "low" tier. JS-driven animations (smooth scroll, height tweens, view transitions) check
 * this; CSS animations are switched off by `html[data-perf="low"]` in global.css.
 * @returns {boolean}
 */
export function prefersLessMotion() {
  if (typeof window === "undefined") return false;
  if (document.documentElement.dataset.perf === "low") return true;
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
