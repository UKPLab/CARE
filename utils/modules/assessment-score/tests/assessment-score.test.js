const {
    calculateAssessmentScore,
    buildScoresFromState,
    scoresFromStoredValue,
    pickScoresFromGradeRows,
} = require("../index");

describe("scoresFromStoredValue", () => {
    test("flattens NLP assessment arrays", () => {
        expect(
            scoresFromStoredValue([
                { name: "Clarity", score: 4 },
                { criterion: "Sources", points: 2 },
            ])
        ).toEqual({ Clarity: 4, Sources: 2 });
    });

    test("flattens numeric maps and currentScore state", () => {
        expect(scoresFromStoredValue({ Clarity: 4, Sources: 2 })).toEqual({ Clarity: 4, Sources: 2 });
        expect(scoresFromStoredValue({ Clarity: { currentScore: 3 } })).toEqual({ Clarity: 3 });
    });

    test("parses fenced JSON", () => {
        expect(
            scoresFromStoredValue('```json\n[{"name":"Clarity","score":4}]\n```')
        ).toEqual({ Clarity: 4 });
    });

    test("parses double-encoded JSON", () => {
        const inner = JSON.stringify([{ name: "Clarity", score: 4 }]);
        expect(scoresFromStoredValue(JSON.stringify(inner))).toEqual({ Clarity: 4 });
    });

    test("unwraps an output wrapper", () => {
        expect(scoresFromStoredValue({ output: { Clarity: 4, Sources: 2 } })).toEqual({
            Clarity: 4,
            Sources: 2,
        });
    });
});

describe("pickScoresFromGradeRows", () => {
    test("prefers a saved row when any criterion is saved, including all zeros", () => {
        expect(
            pickScoresFromGradeRows([
                { key: "aiHook_1", value: [{ name: "Clarity", score: 4 }] },
                {
                    key: "assessment_result",
                    value: { Clarity: { currentScore: 0, isSaved: true } },
                },
            ])
        ).toEqual({ Clarity: 0 });
    });

    test("uses hook scores when the saved row was not marked saved", () => {
        expect(
            pickScoresFromGradeRows([
                {
                    key: "assessment_result",
                    value: { Clarity: { currentScore: 1, isSaved: false } },
                },
                { key: "aiHook_1", value: { Clarity: 4 } },
            ])
        ).toEqual({ Clarity: 4 });
    });

    test("keeps saved scores when no hook row has scores", () => {
        expect(
            pickScoresFromGradeRows([
                {
                    key: "assessment_result",
                    value: { Clarity: { currentScore: 2, isSaved: false } },
                },
            ])
        ).toEqual({ Clarity: 2 });
    });
});

describe("buildScoresFromState", () => {
    test("extracts numeric currentScore values", () => {
        expect(
            buildScoresFromState({
                clarity: { currentScore: 3 },
                style: { currentScore: "2" },
            })
        ).toEqual({ clarity: 3, style: 2 });
    });

    test("treats invalid scores as 0", () => {
        expect(
            buildScoresFromState({
                clarity: { currentScore: NaN },
                style: { currentScore: Infinity },
                grammar: { currentScore: "not-a-number" },
            })
        ).toEqual({ clarity: 0, style: 0, grammar: 0 });
    });

    test("skips non-object entries", () => {
        expect(buildScoresFromState({ clarity: null, style: 5 })).toEqual({});
    });
});

describe("calculateAssessmentScore", () => {
    const sumConfig = {
        rubrics: [
            {
                name: "Main",
                code: "main",
                calculation: "sum",
                minPoints: 0,
                maxPoints: 10,
                criteria: [
                    { name: "A", minPoints: 0, maxPoints: 5 },
                    { name: "B", minPoints: 0, maxPoints: 5 },
                ],
            },
        ],
    };

    test("sums criterion scores for sum rubrics", () => {
        const result = calculateAssessmentScore(sumConfig, { A: 4, B: 3 });
        expect(result.achieved_points).toBe(7);
        expect(result.total_max_points).toBe(10);
        expect(result.rubrics.main.score).toBe(7);
    });

    test("clamps out-of-range criterion scores", () => {
        const result = calculateAssessmentScore(sumConfig, { A: 99, B: -1 });
        expect(result.achieved_points).toBe(5);
        expect(result.warnings.some((w) => w.includes("clamped"))).toBe(true);
    });

    test("applies min rubric calculation", () => {
        const config = {
            rubrics: [
                {
                    name: "Deductions",
                    code: "deductions",
                    calculation: "min",
                    minPoints: -5,
                    maxPoints: 0,
                    criteria: [{ name: "Penalty", minPoints: -5, maxPoints: 0 }],
                },
            ],
        };
        const result = calculateAssessmentScore(config, { Penalty: -3 });
        expect(result.rubrics.deductions.score).toBe(-3);
    });

    test("applies max rubric calculation with defaultPoints", () => {
        const config = {
            rubrics: [
                {
                    name: "Base",
                    code: "base",
                    calculation: "max",
                    defaultPoints: 5,
                    minPoints: 0,
                    maxPoints: 10,
                    criteria: [{ name: "Extra", minPoints: -10, maxPoints: 5 }],
                },
            ],
        };
        expect(calculateAssessmentScore(config, { Extra: 2 }).rubrics.base.score).toBe(7);
        expect(calculateAssessmentScore(config, { Extra: -10 }).rubrics.base.score).toBe(0);
    });

    test("excludes bonus rubrics from total max but includes them in achieved points", () => {
        const config = {
            rubrics: [
                {
                    name: "Main",
                    code: "main",
                    calculation: "sum",
                    minPoints: 0,
                    maxPoints: 10,
                    criteria: [{ name: "A", minPoints: 0, maxPoints: 10 }],
                },
                {
                    name: "Bonus",
                    code: "bonus",
                    calculation: "sum",
                    isBonus: true,
                    minPoints: 0,
                    maxPoints: 5,
                    criteria: [{ name: "B", minPoints: 0, maxPoints: 5 }],
                },
            ],
        };
        const result = calculateAssessmentScore(config, { A: 8, B: 5 });
        expect(result.total_max_points).toBe(10);
        expect(result.achieved_points).toBe(10);
    });

    test("caps achieved points at total max across rubrics", () => {
        const config = {
            rubrics: [
                {
                    name: "R1",
                    code: "r1",
                    calculation: "sum",
                    minPoints: 0,
                    maxPoints: 5,
                    criteria: [{ name: "A", minPoints: 0, maxPoints: 5 }],
                },
                {
                    name: "R2",
                    code: "r2",
                    calculation: "sum",
                    minPoints: 0,
                    maxPoints: 5,
                    criteria: [{ name: "B", minPoints: 0, maxPoints: 5 }],
                },
            ],
        };
        const result = calculateAssessmentScore(config, { A: 5, B: 5 });
        expect(result.achieved_points).toBe(10);
    });

    test("warns about unknown criteria in scores map", () => {
        const result = calculateAssessmentScore(sumConfig, { A: 1, unknown: 2 });
        expect(result.warnings.some((w) => w.includes("unknown criteria"))).toBe(true);
        expect(result.achieved_points).toBe(1);
    });
});
