const {
    calculateAssessmentScore,
    buildScoresFromState,
    scoresFromStoredValue,
    pickScoresFromGradeRows,
    defaultCriterionState,
    withDefaultCriterionStates,
    unsavedCriterionNames,
    parseSavedAssessment,
    normalizeAiAssessment,
    mergeAssessmentSources,
    persistedAssessment,
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

describe("assessment form state", () => {
    const formConfig = {
        rubrics: [
            { name: "R1", criteria: [{ name: "Clarity" }, { name: "Sources" }] },
            { name: "R2", criteria: [{ name: "Style" }, null, {}] },
        ],
    };

    test("adds an empty state only for criteria without one", () => {
        const kept = { ...defaultCriterionState(), currentScore: 3, isSaved: true };
        const state = withDefaultCriterionStates(formConfig, { Clarity: kept });
        expect(Object.keys(state)).toEqual(["Clarity", "Sources", "Style"]);
        expect(state.Clarity).toBe(kept);
        expect(state.Style).toEqual(defaultCriterionState());
    });

    test("lists criteria that are not saved, in rubric order", () => {
        const state = { Clarity: { isSaved: true }, Sources: { isSaved: false } };
        expect(unsavedCriterionNames(formConfig, state)).toEqual(["Sources", "Style"]);
        expect(unsavedCriterionNames(null, state)).toEqual([]);
    });

    test("parses saved answers and ignores unreadable ones", () => {
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        expect(parseSavedAssessment('{"Clarity":{"currentScore":2}}')).toEqual({ Clarity: { currentScore: 2 } });
        expect(parseSavedAssessment({ Clarity: { currentScore: 2 } })).toEqual({ Clarity: { currentScore: 2 } });
        expect(parseSavedAssessment("not json")).toEqual({});
        expect(parseSavedAssessment(undefined)).toEqual({});
        expect(parseSavedAssessment("")).toEqual({});
        errorSpy.mockRestore();
    });

    test("normalizes AI results given as justifications or as form states", () => {
        expect(normalizeAiAssessment(JSON.stringify({
            assessment: [{ criterion: "Clarity", justification: "Clear", score: 4 }, { score: 1 }],
        }))).toEqual([{ name: "Clarity", assessment: "Clear", editedAssessment: "", currentScore: 4 }]);
        expect(normalizeAiAssessment([{ criterion: "Style", assessment: "Ok", currentScore: 2 }]))
            .toEqual([{ name: "Style", criterion: "Style", assessment: "Ok", currentScore: 2 }]);
        expect(normalizeAiAssessment({ result: [] })).toBeNull();
        expect(normalizeAiAssessment(null)).toBeNull();
    });

    test("saved answers win over AI answers; answers of an earlier step are not saved yet", () => {
        const saved = { Clarity: { assessment: "Mine", currentScore: 1, isSaved: true } };
        const ai = [{ name: "Clarity", currentScore: 5 }, { name: "Sources", currentScore: 4, isSaved: true }];
        const merged = mergeAssessmentSources(formConfig, {}, { saved, ai });
        expect(merged.Clarity).toMatchObject({ assessment: "Mine", currentScore: 1, isSaved: true });
        expect(merged.Sources).toMatchObject({ currentScore: 4, isSaved: false });
        expect(merged.Style).toEqual(defaultCriterionState());

        const fromPrevious = mergeAssessmentSources(formConfig, {}, { saved, fromPreviousStep: true });
        expect(fromPrevious.Clarity).toMatchObject({ assessment: "Mine", isSaved: false });
    });

    test("stores only the persisted fields of each criterion", () => {
        const state = {
            Clarity: { assessment: "A", editedAssessment: undefined, currentScore: 2, isEditing: true, isSaved: 1 },
            Empty: null,
        };
        expect(persistedAssessment(state)).toEqual({
            Clarity: { assessment: "A", editedAssessment: "", currentScore: 2, isSaved: false },
        });
    });
});
