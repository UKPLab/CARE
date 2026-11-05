<template>
  <div
    class="home-spark"
    :class="{ 'is-empty': max === 0, 'is-active': hoverIndex !== null }"
  >
    <div
      class="home-spark-plot"
      role="img"
      :aria-label="summary"
      @mousemove="onMove"
      @mouseleave="hoverIndex = null"
    >
      <svg
        :viewBox="`0 0 ${width} ${height}`"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            :id="gradientId"
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop
              offset="0%"
              stop-color="currentColor"
              stop-opacity=".28"
            />
            <stop
              offset="100%"
              stop-color="currentColor"
              stop-opacity="0"
            />
          </linearGradient>
        </defs>
        <line
          class="home-spark-base"
          x1="0"
          :x2="width"
          :y1="baseline"
          :y2="baseline"
          vector-effect="non-scaling-stroke"
        />
        <path
          :d="areaPath"
          :fill="`url(#${gradientId})`"
        />
        <path
          class="home-spark-line"
          :d="linePath"
          vector-effect="non-scaling-stroke"
        />
      </svg>

      <!-- HTML, not SVG: the SVG is stretched, a circle in it would be an ellipse. -->
      <template v-if="hover">
        <i
          class="home-spark-guide"
          :style="{ left: hover.left }"
        />
        <i
          class="home-spark-dot"
          :style="{ left: hover.left, top: hover.top }"
        />
      </template>

      <div
        v-if="hover"
        class="home-spark-tip"
        :class="`is-${hover.align}`"
        :style="{ left: hover.left }"
      >
        <div><strong>{{ hover.count }}</strong> {{ description }}</div>
        <small>{{ $t('dashboard.home.activityWeek', { range: hover.range }) }}</small>
      </div>
    </div>

    <div
      class="home-spark-axis"
      aria-hidden="true"
    >
      <small>{{ startLabel }}</small>
      <small>{{ $t('dashboard.home.activityNow') }}</small>
    </div>
  </div>
</template>

<script>
import { formatLocalizedDate } from "@/assets/utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;
const SHORT_DATE = { day: "numeric", month: "short" };

/**
 * Smooth path through the points that never overshoots between two
 * values (monotone cubic, as d3.curveMonotoneX). A plain spline would
 * dip below the baseline next to a spike.
 *
 * @param {Array<[number, number]>} points Equally spaced on x.
 * @returns {string} SVG path data, starting with a moveto.
 */
function monotonePath(points) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
  const slopes = [];
  for (let i = 0; i < points.length - 1; i++) {
    slopes.push((points[i + 1][1] - points[i][1]) / (points[i + 1][0] - points[i][0]));
  }
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === points.length - 1) return slopes[i - 1];
    const a = slopes[i - 1];
    const b = slopes[i];
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  let d = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const third = (x1 - x0) / 3;
    d += ` C${(x0 + third).toFixed(2)},${(y0 + tangents[i] * third).toFixed(2)}`
      + ` ${(x1 - third).toFixed(2)},${(y1 - tangents[i + 1] * third).toFixed(2)}`
      + ` ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }
  return d;
}

/**
 * Activity sparkline for a Home tile, like the small graphs in the
 * GitHub repository list. One point per week, ending with the current
 * week. Hovering shows what the graph counts and the value of the
 * nearest week; the axis below names the period.
 */
export default {
  name: "HomeActivityGraph",
  props: {
    /** Dates to count: Date objects, ISO strings, or timestamps. */
    dates: {
      type: Array,
      default: () => [],
    },
    /** What one count means, e.g. "documents added". Shown on hover. */
    description: {
      type: String,
      required: true,
    },
    /** Number of weeks shown, ending with the current week. */
    weeks: {
      type: Number,
      default: 12,
    },
  },
  data() {
    // SVG user units; the SVG is stretched to the plot box.
    return { width: 100, height: 40, padding: 4, hoverIndex: null };
  },
  computed: {
    gradientId() {
      return `home-spark-fill-${this.$.uid}`;
    },
    today() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    },
    /** Monday 00:00 local time of the first week shown. */
    start() {
      const weekday = (this.today.getDay() + 6) % DAYS_PER_WEEK;
      return new Date(
        this.today.getFullYear(),
        this.today.getMonth(),
        this.today.getDate() - weekday - (this.weeks - 1) * DAYS_PER_WEEK
      );
    },
    buckets() {
      const buckets = new Array(this.weeks).fill(0);
      const from = this.start.getTime();
      for (const value of this.dates) {
        if (value === null || value === undefined || value === "") continue;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) continue;
        const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        // Round so a DST switch inside the range does not shift a day.
        const week = Math.floor(Math.round((midnight - from) / DAY_MS) / DAYS_PER_WEEK);
        if (week >= 0 && week < this.weeks) buckets[week]++;
      }
      return buckets;
    },
    max() {
      return Math.max(0, ...this.buckets);
    },
    total() {
      return this.buckets.reduce((sum, count) => sum + count, 0);
    },
    baseline() {
      return this.height - this.padding;
    },
    points() {
      const last = Math.max(1, this.buckets.length - 1);
      const span = this.baseline - this.padding;
      // Square-root scale: one busy week would otherwise flatten all
      // the others into the baseline. The tooltip shows real numbers.
      const scale = Math.sqrt(this.max);
      return this.buckets.map((count, i) => [
        (i / last) * this.width,
        scale === 0 ? this.baseline : this.baseline - (Math.sqrt(count) / scale) * span,
      ]);
    },
    linePath() {
      return monotonePath(this.points);
    },
    areaPath() {
      if (this.points.length === 0) return "";
      return `${this.linePath} L${this.width},${this.height} L0,${this.height} Z`;
    },
    startLabel() {
      return formatLocalizedDate(this.start, SHORT_DATE);
    },
    summary() {
      return this.$t("dashboard.home.activitySummary", {
        description: this.description,
        count: this.total,
        weeks: this.weeks,
      });
    },
    hover() {
      if (this.hoverIndex === null) return null;
      const i = this.hoverIndex;
      const [x, y] = this.points[i];
      const from = new Date(this.start.getFullYear(), this.start.getMonth(), this.start.getDate() + i * DAYS_PER_WEEK);
      const weekEnd = new Date(from.getFullYear(), from.getMonth(), from.getDate() + DAYS_PER_WEEK - 1);
      const to = weekEnd > this.today ? this.today : weekEnd;
      const ratio = x / this.width;
      return {
        count: this.buckets[i],
        left: `${ratio * 100}%`,
        top: `${(y / this.height) * 100}%`,
        align: ratio < 0.25 ? "start" : ratio > 0.75 ? "end" : "center",
        range: `${formatLocalizedDate(from, SHORT_DATE)} – ${formatLocalizedDate(to, SHORT_DATE)}`,
      };
    },
  },
  methods: {
    onMove(event) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width === 0) return;
      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      this.hoverIndex = Math.round(ratio * (this.weeks - 1));
    },
  },
};
</script>

<style scoped>
/* Right column of the .home-tile grid (global.css), full tile height. */
.home-spark {
  grid-column: 2;
  grid-row: 1 / -1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  color: var(--care-primary);
}

.home-spark-plot {
  position: relative;
  flex: 1 1 auto;
  min-height: 36px;
}

.home-spark-plot svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.home-spark-base {
  stroke: var(--bs-border-color-translucent);
  stroke-width: 1px;
  stroke-dasharray: 2 3;
}

.home-spark-line {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75px;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.home-spark.is-empty {
  color: var(--bs-secondary-color);
}

.home-spark.is-empty .home-spark-line {
  opacity: .45;
}

.home-spark-guide {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: color-mix(in srgb, currentColor 35%, transparent);
  pointer-events: none;
}

.home-spark-dot {
  position: absolute;
  width: 7px;
  height: 7px;
  margin: -3.5px 0 0 -3.5px;
  border: 1.5px solid var(--bs-body-bg);
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 1px currentColor;
  pointer-events: none;
}

.home-spark-tip {
  /* Below the plot: the tiles are the first row of the scroll
     container, so a tip above them could be clipped. */
  position: absolute;
  top: calc(100% + 6px);
  z-index: 5;
  display: flex;
  flex-direction: column;
  padding: 5px 8px;
  border-radius: 6px;
  color: var(--bs-body-bg);
  background: var(--bs-emphasis-color);
  box-shadow: var(--care-shadow-2);
  font-size: .75rem;
  line-height: 1.3;
  white-space: nowrap;
  pointer-events: none;
}

.home-spark-tip.is-start {
  transform: translateX(-12px);
}

.home-spark-tip.is-center {
  transform: translateX(-50%);
}

.home-spark-tip.is-end {
  transform: translateX(calc(-100% + 12px));
}

.home-spark-tip strong {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.home-spark-tip small {
  opacity: .7;
  font-size: .7rem;
}

/* Period under the graph: first Monday on the left, "now" on the right,
   with a hairline tick at each end. */
.home-spark-axis {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  margin-top: 4px;
  color: var(--bs-secondary-color);
  font-size: .68rem;
  line-height: 1;
  letter-spacing: .01em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.home-spark-axis small {
  font-size: inherit;
}

.home-spark-axis small:first-child::before,
.home-spark-axis small:last-child::after {
  content: "";
  display: inline-block;
  width: 1px;
  height: 6px;
  margin: 0 4px;
  vertical-align: -1px;
  background: var(--bs-border-color);
}

.home-spark-axis small:first-child::before {
  margin-left: 0;
}

.home-spark-axis small:last-child::after {
  margin-right: 0;
}
</style>
