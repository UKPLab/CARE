/**
 *
 * config: full assessment configuration (with rubrics & criteria)
 * scores: flat map { [criterionName]: number }
 *
 * Returns:
 *   {
 *     total_max_points,
 *     total_min_points,
 *     achieved_points,
 *     rubrics: {
 *       [rubric_code]: { name, score, min, max }
 *     },
 *     warnings: string[]
 *   }
 */

export function calculateAssessmentScore(config, scores = {}) {
    const warnings = [];

    const rubrics = Array.isArray(config?.rubrics) ? config.rubrics : [];

    // 1. Collect known criteria
    const knownCriteria = new Set();
    rubrics.forEach((rubric) => {
        (rubric.criteria || []).forEach((crit) => {
            const cname = crit && crit.name;
            if (cname) knownCriteria.add(cname);
        });
    });

    // 2. Warn about unknown scores
    const scoreKeys = Object.keys(scores);
    const unknownScores = scoreKeys.filter((k) => !knownCriteria.has(k));
    if (unknownScores.length) {
        warnings.push(
            `Scores provided for unknown criteria (ignored): ${unknownScores.sort().join(", ")}`
        );
    }

    let total_max_points = 0;
    let total_min_points = 0;
    let achieved_points = 0;
    const rubricResults = {};

    rubrics.forEach((rubric) => {
        const rubric_name = rubric.name || "";
        const rubric_code = rubric.code || rubric_name;
        const criteria = rubric.criteria || [];
        const calc = rubric.calculation || "sum";

        const crit_scores = [];
        let crit_min_points_sum = 0;
        let crit_max_points_sum = 0;

        // 3. Criterion-level handling
        criteria.forEach((crit) => {
            if (!crit) return;
            const cname = crit.name || "<unnamed>";

            let cmin = crit.minPoints;
            let cmax = crit.maxPoints;

            // Criterion min/max defaults
            if (cmin === undefined || cmin === null) {
                cmin = 0;
                warnings.push(
                    `Criterion '${cname}' in rubric '${rubric_name}' has no minPoints, defaulting to 0.`
                );
            }
            if (cmax === undefined || cmax === null) {
                cmax = 0;
                warnings.push(
                    `Criterion '${cname}' in rubric '${rubric_name}' has no maxPoints, defaulting to 0.`
                );
            }

            cmin = Number(cmin) || 0;
            cmax = Number(cmax) || 0;

            crit_min_points_sum += cmin;
            crit_max_points_sum += cmax;

            const rawVal =
                Object.prototype.hasOwnProperty.call(scores, cname) && scores[cname] != null
                    ? Number(scores[cname])
                    : 0;

            let clamped = isNaN(rawVal) ? 0 : rawVal;
            if (clamped < cmin || clamped > cmax) {
                warnings.push(
                    `Score ${rawVal} for criterion '${cname}' in rubric '${rubric_name}' was clamped to [${cmin}, ${cmax}].`
                );
                if (clamped < cmin) clamped = cmin;
                if (clamped > cmax) clamped = cmax;
            }

            crit_scores.push(clamped);
        });

        // 4. Rubric-level min/max, derived from criteria if missing
        let rubric_min = rubric.minPoints;
        let rubric_max = rubric.maxPoints;

        if (rubric_min === undefined || rubric_min === null) {
            rubric_min = crit_min_points_sum;
            warnings.push(
                `Rubric '${rubric_name}' has no minPoints, derived from criteria as ${rubric_min}.`
            );
        }
        if (rubric_max === undefined || rubric_max === null) {
            rubric_max = crit_max_points_sum;
            warnings.push(
                `Rubric '${rubric_name}' has no maxPoints, derived from criteria as ${rubric_max}.`
            );
        }

        rubric_min = Number(rubric_min) || 0;
        rubric_max = Number(rubric_max) || 0;

        // 5. Compute rubric raw score according to calculation
        let rubric_raw_score = 0;
        const sumCrit = crit_scores.reduce((acc, v) => acc + v, 0);

        if (!crit_scores.length) {
            rubric_raw_score = 0;
        } else if (calc === "sum") {
            rubric_raw_score = sumCrit;
        } else if (calc === "min") {
            rubric_raw_score = Math.min(sumCrit, rubric_max);
        } else if (calc === "max") {
            const base = Number(rubric.defaultPoints) || 0;
            let computed = base + sumCrit;
            if (computed < 0) computed = 0;
            rubric_raw_score = computed;
        } else {
            warnings.push(
                `Unknown calculation '${calc}' for rubric '${rubric_name}', falling back to 'sum'.`
            );
            rubric_raw_score = sumCrit;
        }

        // 6. Clamp rubric score
        let rubric_score = rubric_raw_score;
        if (rubric_score < rubric_min) rubric_score = rubric_min;
        if (rubric_score > rubric_max) rubric_score = rubric_max;

        rubricResults[rubric_code] = {
            name: rubric_name,
            score: rubric_score,
            min: rubric_min,
            max: rubric_max,
            isBonus: rubric.isBonus === true,
        };

        const isBonusRubric = rubric.isBonus === true;

        if (!isBonusRubric) {
            total_max_points += rubric_max;
            total_min_points += rubric_min;
        }
        achieved_points += rubric_score;
        achieved_points = Math.min(achieved_points, total_max_points);

    });

    return {
        total_max_points,
        total_min_points,
        achieved_points,
        rubrics: rubricResults,
        warnings,
    };
}

/**
 * Helper: convert assessmentState into { criterionName: score }
 */
export function buildScoresFromState(assessmentState = {}) {
    const scores = {};
    Object.entries(assessmentState).forEach(([name, st]) => {
        if (!st) return;
        const raw =
            typeof st.currentScore === "number" ? st.currentScore : Number(st.currentScore);
        scores[name] = isNaN(raw) ? 0 : raw;
    });
    return scores;
}
