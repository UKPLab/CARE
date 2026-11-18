<template>
            <select
                v-model.number="scoreProxy"
                class="form-select form-select-sm score-dropdown"
                :title="$t('assessment.criteria.changeScore')"
            >
              <option
                  v-for="point in pointsDescending"
                  :key="point"
                  :value="point"
              >
                {{ point }} P
              </option>
            </select>
</template>

<script>
export default {
  name: 'AssessmentScoreInput',
  props: {criterion: {type: Object, required: true}, modelValue: {type: Object, required: true}},
  emits: ['update:modelValue'],
  computed: {
    state: {get() { return this.modelValue || {}; }, set(value) { this.$emit('update:modelValue', value); }},
hasScoringList() {
      return Array.isArray(this.criterion.scoring) && this.criterion.scoring.length > 0;
    },
availablePoints() {
      // Use scoring list if present
      if (this.hasScoringList) {
        return this.criterion.scoring.map((opt) =>
            opt.points !== undefined ? opt.points : opt.score
        );
      }

      // Fallback: build range from min/max
      const min =
          this.criterion.minPoints !== undefined
              ? this.criterion.minPoints
              : 0;
      const max =
          this.criterion.maxPoints !== undefined
              ? this.criterion.maxPoints
              : this.criterion.maxScore;
      if (max === undefined) return [0];

      const values = [];
      for (let i = min; i <= max; i++) values.push(i);
      return values;
    },
pointsDescending() {
      return [...this.availablePoints].sort((a, b) => b - a);
    },
scoreProxy: {
      get() {
        const s = this.state.currentScore;
        if (typeof s === "number") return s;

        // Prefer first scoring option if list exists
        if (this.hasScoringList) {
          const first = this.criterion.scoring[0];
          return first.points !== undefined ? first.points : first.score;
        }

        // Otherwise, fall back to availablePoints
        const pts = this.availablePoints;
        return pts.length ? pts[0] : 0;
      },
      set(val) {
        const num = typeof val === "number" ? val : Number(val);
        this.state = {
          ...this.state,
          currentScore: isNaN(num) ? 0 : num,
          isSaved: false,
        };
      },
    }
  },
};
</script>

<style scoped>
.score-dropdown {
  min-width: 80px;
  font-size: 0.875rem;
  border: 1px solid var(--bs-border-color, #ced4da);
  border-radius: 4px;
  padding: 4px 8px;
  background-color: var(--bs-body-bg, white);
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.score-dropdown:focus {
  border-color: var(--care-primary);
  box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--care-primary) 25%, transparent);
  outline: 0;
}
</style>
