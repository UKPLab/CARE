# Workflow → Study → Step → NLP Skill → UI: How It All Fits Together

This is a plain-language walkthrough of how configuration flows through CARE, from
the moment you author a workflow down to the point where a result shows up in the
editor or the assessment sidebar. It follows the same order we explored the topic in,
so each section builds gently on the one before it.

> A quick note on wording: the system reuses the word **"configuration"** for three
> different things. Most of the early confusion comes from that. We separate them
> clearly below.

---

## 1. The three things all called "configuration"

| Name | Lives in | What it really is |
|---|---|---|
| **Configuration entity** | `configuration` table | A standalone, named, reusable JSON record (e.g. an assessment rubric). Has its own `id`, a `type` (`0 = Assessment`, `1 = Validation`), and a `content`. |
| **Workflow-step configuration** | `workflow_step.configuration` (JSONB) | The **blueprint / template** for a step. Often a *form schema* (`settings.fields`) describing what the researcher must choose. |
| **Study-step configuration** | `study_step.configuration` (JSONB) | The **per-study instance** — the researcher's actual answers for one specific study. |

Keep this table in mind; everything else is just these three interacting.

References: [`configuration.js`](../backend/db/models/configuration.js#L13-L63),
[`workflow_step.js`](../backend/db/models/workflow_step.js#L47-L54),
[`study_step.js`](../backend/db/models/study_step.js#L328).

---

## 2. A workflow is a template; a study is an instance of it

When you author a **workflow**, you build a sequence of **workflow steps**. Each step
carries its own `configuration`. A single workflow can be the parent of many studies
(`Workflow.hasMany(study)`), so anything defined on a workflow step is a *shared default*.

When you create a **study** from that workflow, CARE walks the workflow's steps and
creates one **study step** per workflow step
([`study.js` createStudySteps](../backend/db/models/study.js#L252-L277)):

```js
const stepDocument = options.context.stepDocuments.find(doc => doc.id === workflowStep.id);
const customConfig  = stepDocument?.configuration || {};
await study_step.add({
    workflowStepId: workflowStep.id,   // study step links back to its template
    configuration: customConfig,       // but stores ITS OWN config (your study-setup answers)
});
```

The important nuance: the study step's `configuration` does **not** come straight from
`workflowStep.configuration`. It comes from `stepDocuments` — the per-study payload you
submit during study setup, matched to each workflow step **by the workflow step's id**.

So we never *edit* the workflow step. The study step is a fresh row that *points back*
to the workflow step (`workflowStepId`) but holds an independent copy of the settings
for this one study. Edit it later and only this study changes.

---

## 3. The workflow step asks the questions; the study step holds the answers

A workflow step's configuration is usually a **form schema**, not a set of values
([migration](../backend/db/migrations/20250807202735-extended-workflow.js#L12-L42)):

```js
configuration: {
  settings: {
    fields: [                                  // ← the QUESTIONS
      { key: "configurationId",
        label: "Assessment Configuration File:",
        type: "select",
        options: { table: "configuration",
                   filter: [{ key: "type", value: 0 }] } },   // pick an Assessment config
      { key: "forcedAssessment", type: "switch", default: false }
    ]
  },
  services: [{ name: "nlpAssessment", type: "nlpRequest" }]    // this step runs NLP
}
```

During study setup, the modal renders those `fields`
([`ConfigurationModal.vue`](../frontend/src/basic/modal/ConfigurationModal.vue#L181)),
the researcher answers them, and the answers become the study step's config:

```js
study_step.configuration = { settings: { configurationId: 42, forcedAssessment: true } }
```

Both use the word `settings`, but they hold different shapes:

| | Workflow step | Study step |
|---|---|---|
| `settings` holds | `fields: [...]` (the menu) | `configurationId: 42`, `forcedAssessment: true` (the choice) |
| Meaning | "Here's what you must choose" | "Here's what was chosen for this study" |

---

## 4. Where the configuration entity comes in — pool vs. specific choice

The reusable **configuration entity** (e.g. *"Grammar Assessment v2"*, id 42) is referenced
in *both* layers, but differently:

- **Workflow step → references the configuration *table* (the pool).**
  `options.table = "configuration"` with `filter: type === 0` means "the answer must be
  *some* Assessment-type config." It defines the **menu**.
- **Study step → references one specific entity by id.**
  `settings.configurationId = 42` is the **chosen item**.

At runtime the backend resolves the *specific* one
([`templateResolver.js`](../backend/utils/templateResolver.js#L320-L323)):

```js
const configurationId = studyStep.configuration?.settings?.configurationId || null;
if (configurationId) {
    const configuration = await models["configuration"].getById(configurationId);
    assessmentConfiguration = configuration?.content || "";   // → ~assessmentConfiguration~
}
```

So `~assessmentConfiguration~` is **not** statically bound to a config. It resolves
through the current study step: *whatever config this step points to* is what fills it.
Same prompt, different step → different rubric, automatically.

---

## 5. How a prompt knows which placeholders it may use

There are two levels of "which":

1. **Which placeholders are allowed** — the `placeholder` table, keyed by template `type`.
   `allow(key)` is true only if that key is registered for this template's type
   ([`templateResolver.js`](../backend/utils/templateResolver.js#L434-L442)).
2. **Which specific config fills it** — the study step's `settings.configurationId`.

There is no direct "this prompt uses config X" link. The **study step is the join point**
between a prompt slot and a specific configuration.

---

## 6. Prompt templates today define the *input* only — not the output

A prompt template (type 8) defines the prompt text and its **input** placeholders
(`pdfText`, `editorText`, `assessmentConfiguration`, …). It has **no output contract**:
the template model has no schema/output field, and the chat path
([`chat.js`](../backend/webserver/services/ai/chat.js#L36-L105)) is a thin pass-through
that returns free text.

This is the gap worth knowing about: a prompt template produces *the question*, not the
*shape of the answer*.

---

## 7. NLP skills, by contrast, carry an output contract

An NLP skill's `config` has both an `input` and an `output`. CARE doesn't author it — the
skill node declares it and CARE caches/echoes it
([`nlp.js`](../backend/webserver/services/nlp.js#L334)):

- `config.output.data` — a map whose **keys** are the output field names (the contract).
- `config.output.example` — a sample payload (for display only).

So yes — we *do* know the output shape, because the skill ships it.

---

## 8. The frontend renders dynamically, but never guesses widgets from data type

Two distinct rendering mechanisms — and neither inspects whether a value is "text" or
"array" to pick a control:

**A. Skill input/output mapping (uniform, key-driven).**
Every input and output is rendered as the *same* control — a dropdown — using only the
**keys** of `config.input.data` / `config.output.data`
([`InputMap.vue`](../frontend/src/basic/modal/skills/InputMap.vue#L4-L31)). The data type
of an output never changes the widget; it only decides *how many* rows appear.

**B. Schema-driven forms (explicit `type` discriminator).**
For configuration/settings fields, each field declares a `type` string, and
[`FormFields.vue`](../frontend/src/basic/form/FormFields.vue#L7-L100) maps it to a widget:

```
type: "switch"   → <FormSwitch>
type: "select"   → <FormSelect>
type: "json"     → <FormJsonTextarea>   (arrays/objects)
type: "table"    → <FormTable>
…                → <FormDefault>         (fallback)
```

So the widget is always *declared*, never *inferred* from the runtime value.

---

## 9. Putting a skill on a step: inputs, run-timing, and outputs

Say a workflow step has an NLP skill that needs **a PDF** and **an assessment config**.

**Inputs** — during study setup you fill the two values via the input mapping:
the PDF from documents/submissions, and the configuration from Assessment-type
(`type 0`) configurations.

**Run-timing — preload, not on click.** A service of `type === 'nlpRequest'` on the step
config runs automatically when the step loads:

- [`LoadingModal.vue`](../frontend/src/components/study/LoadingModal.vue#L153-L154) filters
  `config.services` for `type === 'nlpRequest'` and blocks the step behind a loading
  screen until they finish.
- [`NlpRequest.vue`](../frontend/src/basic/service/NlpRequest.vue#L111-L116) fires
  `sendRequest()` on `mounted()` (unless results already exist).

There is no "on click" flag in this config — `type: 'nlpRequest'` means "run on step entry."

**Outputs — the destination decides the UI.** The output mapping offers only two sinks
([`InputMap.vue`](../frontend/src/basic/modal/skills/InputMap.vue#L244-L262)):

- `saveInDocumentData` — always available.
- `insertIntoEditor` — **only on Editor steps** (`stepType === 2`).

At runtime:
- `insertIntoEditor` → emits `insert-nlp-response`, text drops into the editor
  ([`LoadingModal.vue`](../frontend/src/components/study/LoadingModal.vue#L318-L326)).
- otherwise → saved to `document_data` under `${service.name}_${skill}_${outputKey}`
  ([`NlpRequest.vue`](../frontend/src/basic/service/NlpRequest.vue#L196-L205)), then read
  by a purpose-built consumer (the assessment sidebar, or a prompt placeholder).

---

## 10. The assessment sidebar expects a specific shape

The sidebar is a purpose-built consumer with a fixed contract:

- It looks for a result field literally named **`assessment`** → key
  `${service.name}_${skill}_assessment`
  ([`Assessment.vue`](../frontend/src/components/study/Assessment.vue#L207-L208);
  backend mirror in [`studyNlpDocumentData.js`](../backend/utils/studyNlpDocumentData.js#L11)).
- It then maps that onto the chosen configuration's **rubrics → criteria** by name
  ([`Assessment.vue`](../frontend/src/components/study/Assessment.vue#L240-L242)).

So it expects an `assessment` field whose contents line up with the selected
configuration's rubric/criteria structure.

---

## 11. What happens if the output shape doesn't match

Gently put: **nothing validates it, and mismatches fail quietly rather than loudly.**

- `saveResult` stores whatever keys the result has — no schema check.
- Wrong field name (not `assessment`) → the sidebar/resolver can't find it → empty draft,
  empty placeholder. No crash.
- Right field but mismatched criteria names → unmatched criteria stay at their defaults,
  extra fields are ignored, and the score calculator may log a warning
  ([`Assessment.vue`](../frontend/src/components/study/Assessment.vue#L262-L266)).
- `insertIntoEditor` inserts whatever the value is; placeholders serialize objects/arrays
  to JSON text.

The takeaway: the **consumer** defines the expected shape — CARE will not reconcile a
different structure for you. A skill that feeds the assessment sidebar should emit an
`assessment` field matching the selected configuration; otherwise its output simply lands
in `document_data` unused.

---

## 12. A step's configuration has three independent sections

The workflow step doesn't only define a skill. Its configuration can declare up to three
sections, each shown in the study-setup modal only if the step declares it
([`ConfigurationModal.vue`](../frontend/src/basic/modal/ConfigurationModal.vue#L159-L171)):

| Section | Appears when | Stored under | Holds | Use it for |
|---|---|---|---|---|
| **General Settings** | `settings.fields` exist | `configuration.settings` | form answers (`configurationId`, toggles, …) | asking the researcher a question at study setup |
| **Services** | `services` exist | `configuration.services` | NLP skill(s) + input/output mapping | running an AI/NLP skill and routing its result |
| **Placeholders** | not `false`/disabled | `configuration.placeholders` | document tokens mapped to data sources | injecting data into the participant's document |

**Examples of each (workflow blueprint → study answer):**

§1 General Settings
```js
// workflow declares the questions
settings: { fields: [
  { key: "configurationId", type: "select", options: { table: "configuration", filter: [{key:"type",value:0}] } },
  { key: "forcedAssessment", type: "switch", default: false }
] }
// study fills the answers
settings: { configurationId: 42, forcedAssessment: true }
```

§2 Services
```js
// workflow declares a slot (no skill bound!)
services: [{ name: "nlpAssessment", type: "nlpRequest", required: true }]
// study picks the skill + maps inputs/outputs
services: [{ name: "nlpAssessment", type: "nlpRequest", skill: "assessment_skill",
            inputs:  { v1: { type:"document", documentId:101 }, v2: { type:"configuration", configurationId:42 } },
            outputs: { assessment: { value:"saveInDocumentData" } } }]
```

§3 Placeholders — the document literally contains `~text~`, `~chart~`, `~comparison~` tokens
([`PlaceholdersStep.vue`](../frontend/src/basic/modal/PlaceholdersStep.vue#L333-L369)); the
study maps each to a source from earlier steps:
```js
placeholders: {
  text:       [{ dataInput: { value:"currentVersion", stepId:1 } }],
  comparison: [{ dataInput: [ { value:"firstVersion", stepId:1 }, { value:"currentVersion", stepId:1 } ] }],
  chart:      [{ dataInput: { value:"service_nlpAssessment_assessment", stepId:2 } }]
}
```

They are independent keys on the same study-step config:
```js
study_step.configuration = {
  settings:     { configurationId: 42, forcedAssessment: true },
  services:     [ { skill: "assessment_skill", inputs: {…}, outputs: {…} } ],
  placeholders: { text: [...], comparison: [...], chart: [...] }
}
```

---

## 13. Worked example: the two seeded peer-review workflows

From [the migration](../backend/db/migrations/20250807202735-extended-workflow.js#L3-L114):

**A — Peer Review (Assessment):** review a PDF, assess against a chosen rubric, write feedback. No AI.

| Step | Type | Config |
|---|---|---|
| 1 | Annotator | §1 Settings only (`configurationId`, `forcedAssessment`) |
| 2 | Editor | no config (free-text editor) |

**B — Peer Review (Assessment with AI):** same shape, but AI assists both steps.

| Step | Type | Config |
|---|---|---|
| 1 | Annotator | §1 Settings **+ §2 `nlpAssessment` skill slot** |
| 2 | Editor | **§2 `textualFeedback` skill slot** |

The only difference between A and B is the **Services** blocks — B adds an `nlpRequest`
slot to each step. Everything else is identical.

---

## 14. What you fill in at study-step creation (Workflow B)

Turning B's blueprint into a concrete study:

- **Study level:** assign a document to each step (the `stepDocuments` field) — a PDF for
  step 1, a (usually new) editor doc for step 2.
- **Step 1 (Annotator):** §1 pick the assessment config (e.g. id 42) + set `forcedAssessment`;
  §2 choose the skill for the `nlpAssessment` slot and map its inputs (PDF, config 42) and
  output (→ `saveInDocumentData`; `insertIntoEditor` is **not** offered on Annotator steps).
- **Step 2 (Editor):** §2 choose the skill for the `textualFeedback` slot, map its inputs,
  and route its output (→ `insertIntoEditor` **is** available here, since it's an Editor step).

So for B you define: one document per step, the rubric + toggle on step 1, and the two
skills' input/output mappings. Everything else stays as the workflow defined it.

---

## 15. The big takeaway: workflow declares a *slot*, the study picks the *skill*

This is the pattern worth remembering:

- The workflow's `services: [{ name, type:"nlpRequest", required }]` is just a **slot** —
  it says "an NLP skill goes here," with **no skill bound**.
- The **study** chooses the actual `skill` and maps its inputs/outputs
  ([`ServicesStep.vue`](../frontend/src/basic/modal/ServicesStep.vue#L225-L231)).

And the skill's input keys (`v1`, `v2`, … from `config.input.data`) are effectively the
skill's **placeholders** — named slots the study binds to data sources.

That gives a clean analogy for prompt templates:

| | NLP skill | Prompt template |
|---|---|---|
| Input slots | `v1`, `v2`, … | `~pdfText~`, `~assessmentConfiguration~`, … |
| Who defines them | the skill provider | the template author |
| Study's job | map each slot → a data source | bind each placeholder → a value |

The one difference today: **skill inputs are explicitly mapped** by the researcher, whereas
**prompt placeholders are auto-resolved** from the study-step context (fixed set per template
type). So if prompt templates were given an explicit input/output **mapping UI like skills**,
their placeholders would become exactly these `v1`/`v2`-style slots — and that same step is
where you'd add the **output contract** prompt templates currently lack (see §6–7).

---

## One-line mental model

> **Workflow** = the questions, defaults, and *empty skill slots* · **Study step** = the
> chosen answers, the *picked skill*, and its input/output mapping · **Configuration entity**
> = the reusable rubric being chosen · **NLP skill** = ships its own input/output contract,
> with `v1`/`v2` as its placeholders · **UI** = decided by the chosen *destination* and a
> fixed *consumer*, never guessed from the data's type.


Now I have the full picture. Let me answer your three questions directly.

1. Is your understanding of settings.fields correct?

Yes, exactly. settings.fields in a workflow step is purely a form schema — it defines what inputs to show the researcher in the study-setup modal. The researcher's answers become the study step's configuration.settings object (replacing fields: [...] with the actual values like configurationId: 42). The workflow step never gets modified.

2. What does each step have?

Workflow	Step	settings.fields?	services?
A (no AI)	Annotator	configurationId + forcedAssessment	—
A (no AI)	Editor	nothing (no config at all)	—
B (AI)	Annotator	configurationId + forcedAssessment	nlpAssessment slot
B (AI)	Editor	nothing	textualFeedback slot
The Editor in both workflows has no settings.fields — it's a free-text editor, so the researcher doesn't choose any configuration for it. Workflow B's Editor only gets an NLP skill slot.

3. Where/how are the settings values used in the UI — and is the sidebar hardcoded?

Yes, the sidebar is hardcoded to specific key names. The values flow like this:

settings.configurationId → Assessment.vue:155 reads it by name: this.config.settings?.configurationId → fetches that specific configuration entity from the store → reads its .content.rubrics → iterates rubric.criteria[] to render the sidebar UI.
settings.forcedAssessment → Assessment.vue:258 reads it by name: currentStudyStep?.configuration?.settings?.forcedAssessment → controls whether all criteria must be saved before proceeding.
So the sidebar doesn't generically render whatever is in settings. It specifically knows to look for configurationId and forcedAssessment by their exact key names, and it specifically expects the configuration entity's content to have a rubrics → criteria structure. If you added a third field to settings.fields in the workflow, nothing would automatically show it in the sidebar — you'd need a hardcoded consumer for it.

The pattern: settings.fields controls what appears in the study-setup modal (dynamic, schema-driven). What happens with those values at runtime in the actual study is determined by hardcoded consumers (like the sidebar) that read specific keys by name.

