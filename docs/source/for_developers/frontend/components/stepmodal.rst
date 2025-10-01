Step Modal
==========

The **StepModal component** (``frontend/src/components/stepmodal/StepModal.vue``) is a **config-driven modal** shown at *Step Type = 3* in a study.  
It can render formatted feedback, dynamic placeholders (text, charts, comparisons), and optionally run **NLP service requests** to compute results before showing the content.

Key features include:
  - Modal UI fully controlled by the **study step configuration** (title, colors, size, buttons)
  - **Placeholder pipeline** that renders content from `studyData` (Text / Chart / Comparison)
  - **NLP orchestration**: send multiple skill requests, wait for results, persist them, handle timeouts & retries
  - Read-only and last-step behaviors (finish/back/export)
  - Emits updates back to the study route (``@update:data``) as the underlying data changes

Overview
--------

The StepModal is opened by the study route when a step with ``stepType === 3`` becomes active.  
It fetches the step’s source document (to display descriptive HTML mixed with placeholders), optionally executes NLP jobs, waits for their results, and renders the final structured output.  
All intermediate and final values are persisted in ``table/document_data`` so later steps can reference them.

Implementing the StepModal
--------------------------

To use StepModal in the study flow:

.. code-block:: html

    <StepModal
      v-if="currentStep.stepType === 3 && studyTrajectory.includes(currentStep.id)"
      :study-step-id="currentStep.id"
      :is-last-step="currentStep.id === lastStep.id"
      @close="handleModalClose"
      @update:data="studyData[studySteps.findIndex(s => s.id === currentStep.id) + 1] = $event"
    />

.. code-block:: javascript

    import StepModal from "@/components/stepmodal/StepModal.vue";

    export default {
      components: { StepModal },
      // Pass studyData down via provide/inject, just like other steps
    };

Initialization & Configuration
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

When mounted, StepModal:

1. **Loads the step configuration** from ``table/study_step`` via the provided ``studyStepId``.
2. **Fetches the document HTML** behind the step (via WebSocket ``documentGet``).  
   The delta is rendered with Quill into HTML that may contain **placeholders** delimited by ``~...~``.
3. **Parses placeholders** and transforms the HTML into **segments**:
   - ``plainText`` (raw HTML between placeholders)
   - ``text`` (``Text.vue``)
   - ``chart`` (``Chart.vue``)
   - ``comparison`` (``Comparison.vue``)

Basic structure:

.. code-block:: html

    <BasicModal
      ref="modal"
      :name="studyStep?.configuration?.name || 'Modal'"
      :class="modalClasses"
      :style="{ backgroundColor: studyStep?.configuration?.backgroundColor || '' }"
      disableKeyboard
      removeClose
    >
      <template #title>
        <h5 class="modal-title" :class="studyStep?.configuration?.titleClass || 'text-primary'">
          {{ studyStep?.configuration?.title || 'Feedback' }}
        </h5>
      </template>

      <template #body>
        <!-- either spinner while waiting for NLP OR the resolved segments -->
      </template>

      <template #footer>
        <!-- Next / Finish / Export / Back to Studies depending on flags -->
      </template>
    </BasicModal>

Modal Look Configuration
~~~~~~~~~~~~~~~~~~~~~~~~

From ``studyStep.configuration``:

- ``modalSize``: bootstrap modal size (e.g., ``xl``)
- ``name``: modal title in the chrome
- ``title`` / ``titleClass``: headline content and color class
- ``backgroundColor`` / ``textColor``: body styling
- ``nextButtonText`` / ``finishButtonText`` / ``finishButtonClass``

Placeholders
------------

StepModal’s document HTML can embed placeholders: ``~text~``, ``~chart~``, or ``~comparison~``.  
They are resolved against **studyData** (the aggregated per-step data array shared across steps):

- **Text.vue**  
  Looks up ``config.input = { stepId, dataSource }`` inside ``studyData[stepId]`` and prints the value.

- **Chart.vue**  
  Either takes a full Chart.js config or builds one from a data object in ``studyData``:
  ``{ labels: [...], values: [...] }`` → produces a horizontal bar chart.

- **Comparison.vue**  
  Reads two inputs and renders a stacked bar chart to compare the two datasets.

Example placeholder configuration inside the step:

.. code-block:: json

    {
      "placeholders": {
        "text": [
          { "input": { "stepId": 2, "dataSource": "summary_text" } }
        ],
        "chart": [
          { "input": { "stepId": 4, "dataSource": "frequency_chart" }, "title": "Edits by Type" }
        ],
        "comparison": [
          {
            "input": [
              { "stepId": 5, "dataSource": "revisionA" },
              { "stepId": 6, "dataSource": "revisionB" }
            ],
            "labels": ["R1", "R2"], "title": "Revisions Compared"
          }
        ]
      }
    }

NLP Integration
---------------

If the step’s configuration contains a ``services`` array with entries of ``type: "nlpRequest"``, StepModal will:

1. **Prepare requests**: build inputs from ``studyData`` using the mapping in ``service.inputs``.  
2. **Send requests** via WebSocket ``serviceRequest`` with a generated ``requestId`` (UUID).  
3. **Wait** until results arrive or a timeout occurs (configured via setting **``modal.nlp.request.timeout``**).  
4. **Persist** each key of the result into ``document_data``:  
   - Keys are namespaced as ``<uniqueId>_<resultKey>``  
   - This makes the data addressable by later steps and by placeholders.

Minimal example of a service entry in ``studyStep.configuration``:

.. code-block:: json

    {
      "services": [
        {
          "type": "nlpRequest",
          "name": "qualityCheck",
          "skill": "quality_assessment",
          "inputs": {
            "text": { "stepId": 1, "dataSource": "final_text" },
            "meta": { "stepId": 1, "dataSource": "meta_info" }
          }
        }
      ]
    }

Timeouts, Errors, Retries
~~~~~~~~~~~~~~~~~~~~~~~~~

- If a request times out, the modal shows an **inline error** with actions:
  - **Try Again** → re-send only the missing result requests
  - **Skip NLP Support** → proceed without the NLP output
- Completed requests are cleaned from the local ``requests`` map and their results removed from the service store after persisting.
