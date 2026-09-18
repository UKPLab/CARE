/**
 * Shared assessment score calculation for CARE frontend and backend.
 *
 * @param {Object} config - Full assessment configuration (with rubrics & criteria)
 * @param {Object} scores - Flat map { [criterionName]: number }
 * @returns {{
 *   total_max_points: number,
 *   total_min_points: number,
 *   achieved_points: number,
 *   rubrics: Object,
 *   warnings: string[]
 * }}
 */
function calculateAssessmentScore(config, scores = {}) {
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

            let clamped = Number.isFinite(rawVal) ? rawVal : 0;
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
        const sumCrit = crit_scores.reduce((acc, v) => acc + v, 0);
        const rubric_raw_score = (() => {
            if (!crit_scores.length) return 0;
            if (calc === "sum") return sumCrit;
            if (calc === "min") return Math.min(sumCrit, rubric_max);
            if (calc === "max") {
                const base = Number(rubric.defaultPoints) || 0;
                const computed = base + sumCrit;
                return computed < 0 ? 0 : computed;
            }
            warnings.push(
                `Unknown calculation '${calc}' for rubric '${rubric_name}', falling back to 'sum'.`
            );
            return sumCrit;
        })();

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
 * Converts assessmentState into { criterionName: score }.
 *
 * @param {Object} assessmentState
 * @returns {Object}
 */
function buildScoresFromState(assessmentState = {}) {
    const scores = {};
    Object.entries(assessmentState).forEach(([name, st]) => {
        if (!st || typeof st !== "object") return;
        const raw =
            typeof st.currentScore === "number" ? st.currentScore : Number(st.currentScore);
        scores[name] = Number.isFinite(raw) ? raw : 0;
    });
    return scores;
}

/**
 * Flatten a stored document_data assessment value into { criterionName: score }.
 * Hook/NLP results are often a list or `{ Clarity: 4 }`, not `{ Clarity: { currentScore } }`.
 *
 * @param {*} value - Raw document_data.value
 * @returns {Object}
 */
function scoresFromStoredValue(value) {
    let parsed = value;
    if (typeof parsed === "string") {
        const trimmed = parsed.trim();
        const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
        try {
            parsed = JSON.parse(fenced ? fenced[1].trim() : trimmed);
        } catch (_error) {
            return {};
        }
    }
    if (typeof parsed === "string") {
        try {
            parsed = JSON.parse(parsed);
        } catch (_error) {
            return {};
        }
    }
    if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        parsed.output != null &&
        parsed.assessment == null
    ) {
        return scoresFromStoredValue(parsed.output);
    }
    if (!parsed || typeof parsed !== "object") return {};

    const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.assessment)
            ? parsed.assessment
            : Array.isArray(parsed.criteria)
                ? parsed.criteria
                : Array.isArray(parsed.results)
                    ? parsed.results
                    : null;
    if (list) {
        const scores = {};
        list.forEach((item) => {
            if (!item || typeof item !== "object") return;
            const name = item.name || item.criterion || item.criterionName || item.title;
            const raw = Number(item.currentScore ?? item.score ?? item.points);
            if (name && Number.isFinite(raw)) scores[name] = raw;
        });
        return scores;
    }

    const fromState = buildScoresFromState(parsed);
    if (Object.keys(fromState).length) return fromState;

    const scores = {};
    Object.entries(parsed).forEach(([name, stored]) => {
        if (typeof stored === "number" && Number.isFinite(stored)) {
            scores[name] = stored;
        }
    });
    return scores;
}

module.exports = {
    calculateAssessmentScore,
    buildScoresFromState,
    scoresFromStoredValue,
};
