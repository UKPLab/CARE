/**
 * Generate a manual test checklist from the assessment keyboard machine.
 *
 * Run from ~/CARE/frontend:
 *   node src/components/study/assessment/generate-paths.js
 *
 * Level A caveat: the machine is a specification, not a runtime controller,
 * so nothing updates context.focusOn. Guards that read it never pass, and
 * those routes are reported as unreachable rather than silently dropped.
 */

import { getShortestPaths, toDirectedGraph } from "xstate/graph";
import { assessmentKeyboardMachine, sneakPaths, observables } from "./assessment-keyboard.machine.js";

const line = (c = "-") => console.log(c.repeat(72));

// --- structure ------------------------------------------------------------
const graph = toDirectedGraph(assessmentKeyboardMachine);
line("=");
console.log("MACHINE STRUCTURE");
line("=");
for (const region of graph.children) {
  const states = region.children.map((s) => s.stateNode.key);
  console.log(`${region.stateNode.key.padEnd(10)} ${states.length} states: ${states.join(", ")}`);
}

// --- generated routes -----------------------------------------------------
const events = [
  { type: "EXPAND" }, { type: "COLLAPSE" }, { type: "EDIT" }, { type: "TYPE" },
  { type: "CTRL_ENTER" }, { type: "ENTER" }, { type: "SPACE" }, { type: "SHIFT_ENTER" },
  { type: "ESCAPE" }, { type: "BLUR" }, { type: "MARK_DONE" },
  { type: "RELOAD", isSaved: false }, { type: "RELOAD", isSaved: true },
  { type: "OPEN_RUBRIC" }, { type: "CLOSE_RUBRIC" }, { type: "OPEN_CRITERION" },
  { type: "CLOSE_CRITERION" }, { type: "ADVANCE" },
  { type: "SAVE_REQUESTED" }, { type: "ACK_OK" }, { type: "ACK_FAIL" },
  { type: "ECHO_MATCH" }, { type: "ECHO_MISMATCH" }, { type: "RETRY" },
];

const short = getShortestPaths(assessmentKeyboardMachine, { events });
const simple = { length: "skipped - combinatorial blow-up on parallel machines" };

line("=");
console.log("GENERATED ROUTES");
line("=");
console.log(`shortest paths : ${short.length}`);
console.log(`simple paths   : ${simple.length}`);
line();

short.forEach((p, i) => {
  const target = JSON.stringify(p.state.value);
  const steps = p.steps.map((s) => s.event.type).join(" -> ") || "(initial)";
  console.log(`${String(i + 1).padStart(3)}. ${target}`);
  console.log(`     ${steps}`);
});

// --- sneak paths ----------------------------------------------------------
line("=");
console.log("SNEAK PATHS - not generated, exported separately");
console.log("(XState cannot distinguish 'explicitly ignored' from 'unhandled')");
line("=");
let n = 0;
for (const g of sneakPaths) {
  for (const ev of g.events) {
    n += 1;
    console.log(`${String(n).padStart(3)}. in ${g.region}.${g.state}: send ${ev} -> expect NOTHING observable to change`);
  }
}

// --- oracle ---------------------------------------------------------------
line("=");
console.log("CHECK AFTER EVERY STEP");
line("=");
observables.forEach((o, i) => console.log(`  ${i + 1}. ${o}`));

line("=");
console.log(`TOTAL: ${short.length} generated routes + ${n} sneak checks`);
line("=");
