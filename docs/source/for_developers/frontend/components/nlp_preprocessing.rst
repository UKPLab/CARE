Apply Skill Modal : Preprocessing 
=============================

The **ApplySkillModal** provides a comprehensive workflow for preprocessing files (documents and submissions) through NLP skills.
This component orchestrates multi-step skill application, skill parameter mapping, input files selection, and asynchronous background processing
with real-time progress monitoring.

Overview
--------

ApplySkillModal allows administrators to:

- Select an NLP skill from available list
- Map skill parameters to data sources (documents, submissions, configurations)
- Select which files to apply skills to
- Configure base document type for result storage in **document_data** table, in case of input mapping with **submission** table type
- Monitor preprocessing progress in real-time
- Cancel ongoing preprocessing if needed (no automatic cancellation when error occurs, needs manual intervention)

The modal operates in two phases:

1. **Setup Phase** (``ApplySkillSetupStepper``): User configures the preprocessing task for the skill input
2. **Processing Phase** (``ApplySkillProcessStepper``): Background task executes and reports progress

Component Architecture
----------------------

**ApplySkillModal** (main container)
  ├── **ApplySkillSetupStepper** (setup workflow)
  │   ├── SkillSelector
  │   ├── InputMap
  │   ├── InputFiles
  │   ├── InputGroup (conditional)
  │   └── InputConfirm
  └── **ApplySkillProcessStepper** (processing monitor)

ApplySkillModal
~~~~~~~~~~~~~~~

The root component that manages the modal lifecycle and coordinates between setup and processing phases.

**Key Responsibilities:**

- Maintains modal state (processing active/inactive)
- Subscribes to background task updates via ``BackgroundTaskService``
- Toggles between setup and process steppers based on processing status
- Handles preprocessing initiation and cancellation

**Emits:** 
  - ``submit`` – when preprocessing configuration is confirmed

**Key Data:**

.. code-block:: javascript

    data: {
        currentStep: Number,           // current step in processing
        isAutoOpened: Boolean,         // whether modal auto-opened
        isWaitingForData: Boolean      // waiting for processing to start
    }

**Key Computed Properties:**

- ``preprocess`` – current preprocessing state from BackgroundTaskService
- ``inputFiles`` – list of selected submissions with metadata
- ``isProcessingActive`` – whether preprocessing requests are queued/running

**Socket Integration:**

Manages subscription to background task updates:

.. code-block:: javascript

    mounted() {
        this.$socket.emit("serviceCommand", {
            service: "BackgroundTaskService",
            command: "subscribeBackgroundTaskUpdates",
            data: {}
        });
    }

ApplySkillSetupStepper
~~~~~~~~~~~~~~~~~~~~~~

A multi-step stepper modal that guides users through configuring a skill application task.

**Steps:**

1. **Select Skill** – Choose NLP skill and map inputs to data sources
2. **Select Files** – Choose files (here, documents or submissions) to process
3. **Select Base Files** (conditional) – For submission-based skills, specify which document type stores results
4. **Confirmation** – Review all settings before submission

**Compulsory input map selection:**

Users must select atleast one data source which is either document or submission, meaning atleast and atmost one table-based selection, in the input mapping step. 
In case, no such selection is made, the step is invalid and user cannot proceed further.

**Conditional Logic:**

Step 3 only appears when the base file parameter maps to a submission (not document or configuration).
This is because submission-based skills have multiple documents and need to specify the target for results.

**Child Components:**

Includes ``SkillSelector``, ``InputMap``, ``InputFiles``, ``InputGroup`` (conditional), 
and ``InputConfirm`` components described below.

**State Management:**

- Resets file selections when skill or mappings change
- Validates that each step's requirements are met before allowing progression, using step-specific validation logic
- Emits ``start-preprocessing`` with formatted configuration when submitted

SkillSelector
^^^^^^^^^^^^^

Dropdown component that displays available NLP skills from the ``NLPService``.
Bound via ``v-model`` and emits ``update:modelValue`` when selection changes.

InputMap
^^^^^^^^

Maps each skill input parameter to a data source (document, submission, or configuration).
Displays options conditionally based on the selected skill and ``studyBased`` flag. In this case, the preprocessing is not study-based.
Emits updated mappings via ``update:modelValue`` and validation state via ``update:valid``.

Each mapping stores: ``{value, tableType, requiresTableSelection}``.

InputFiles
^^^^^^^^^^

Allows multi-select of specific files/submissions for each mapped parameter.
Only shown for parameters where ``requiresTableSelection: true``.
Validates that at least one option is selected per parameter.
Emits selected files and validation state.

InputGroup
^^^^^^^^^^

**Only shown when base file parameter is a submission.**

Allows selection of which document type to save results to (e.g., "pdf", "html", "modal", "zip").
This is derived from the validation configuration attached to a submission-group.
A submission-group is composed of multiple files having the same validation configuration.
Needed because submission-based skill inputs require specifying which document within the submission will save the NLP results, as the skill results need to be stored for a specific ``documentId`` in the ``document_data`` table.

Emits selected base files, validation state, and configuration names.

InputConfirm
^^^^^^^^^^^^

Summary page showing all configured settings before submission.
Displays: skill name, input mappings, selected files count, and base file configuration.
No props modification; purely informational.

ApplySkillProcessStepper
~~~~~~~~~~~~~~~~~~~~~~~~

Monitors real-time progress of preprocessing task execution.

**Two-step display:**

1. **Progress Display** – Shows progress bar, elapsed time, time estimates, and queue of remaining submissions
2. **Cancel Confirmation** – Confirmation dialog before cancelling remaining requests

**Metrics shown:**

- Current processed count and total count
- Progress percentage
- Elapsed time on current request
- Average time per request (from completed items)
- Estimated time remaining
- List of submissions still queued

**State Updates:**

Subscribes to ``BackgroundTaskService`` updates and re-renders progress in real-time.
Users can navigate away or close the program; processing continues in the background and asynchronous.
Can re-open the modal to see current progress.

Backend Integration
-------------------

The frontend communicates with the ``BackgroundTaskService`` (``backend/webserver/services/backgroundTask.js``)
which orchestrates the entire preprocessing workflow.

**Key responsibilities:**

- **Item generation**: Computes the Cartesian product of parameter combinations(the variable is anyways only the table-based parameter selections only, rest are static selections in the Cartesian product) to determine all processing requests.
- **Data preparation**: For each request, loads input data from the database (documents as base64, configurations as JSON)
- **NLP orchestration**: Sends requests to the NLP service and polls for results
- **Result persistence**: Stores results in the ``document_data`` table with keys formatted as ``nlpRequest_{skillName}_{fieldName}``
- **State management**: Maintains preprocessing state and broadcasts updates to all subscribed clients
- **Cancellation**: Supports user-initiated cancellation of remaining requests

**Workflow overview:**

1. ``startPreprocessing()`` validates permissions and initializes state
2. ``prepareProcessingItems()`` generates all parameter combinations
3. For each item:
   - ``prepareNlpInput()`` loads files (as base64 encoded) and configurations
   - ``sendNlpRequest()`` sends to NLP service
   - ``waitForNlpResult()`` polls for result (cancellable at any time)
   - ``saveNlpResult()`` stores result in ``document_data`` table
4. State is broadcasted after each item completes
5. Cleanup and final broadcast when batch finishes or is cancelled

**Input data sources:**

- **submission**: All documents attached to submission, loaded and converted to base64
- **document**: Single document by ID, loaded and converted to base64
- **configuration**: Configuration object by ID, parsed from JSON

**Result storage:**

Results are stored in ``document_data`` with keys like:

.. code-block:: text

    nlpRequest_sentiment-classification_sentiment: "positive"
    nlpRequest_sentiment-classification_confidence: 0.92

This allows multiple NLP results per document, differentiated by skill name and result field.

**Error handling:**

Errors during item processing are caught and logged; processing continues with the next item:

- Missing input data -> item skipped
- NLP timeout -> item skipped, timeout configured in settings
- File not found -> item skipped
- Database errors -> logged, processing continues
- Permission errors -> rejected before processing begins

Cancellation is supported at any time; completed requests remain saved in the database.

Data Flow Example
-----------------

Complete example: Processing a submission with the ``grading_expose`` skill

**User Configuration (Frontend):**

Admin selects the ``grading_expose`` skill, maps the "submission" parameter to ``<Submission>`` data source, 
manually selects 5 individual student submissions (IDs: 10, 11, 12, 13, 14), and configures to save results to PDF documents.

The InputFiles component displays all available submissions grouped by their validation configuration automatically.

**Backend Processing:**

1. ``prepareProcessingItems()`` creates 5 requests (one per selected submission)
2. For each submission:
   - ``prepareNlpInput()`` loads all documents from the submission, converts to base64
   - Input structure: ``{submission: {pdf: "base64...", zip: "base64...", ...}}``
3. ``sendNlpRequest()`` forwards each to the ``grading_expose`` NLP service
4. ``waitForNlpResult()`` polls until result arrives: ``{"assessment": ["name": "Language quality", "score": 1, ...]}``
5. ``saveNlpResult()`` stores one ``document_data`` records to the submission's PDF document:
   - ``nlpRequest_grading_expose_assessment`` -> ["name": "Language quality", "score": 1, ...]
6. Frontend receives ``backgroundTaskUpdate`` broadcast showing progress, final completion

Extending the Service
---------------------

To add support for new parameter types:

1. Update ``InputMap.vue`` to show the new data source in available options
2. Add a ``load{Type}()`` method in ``BackgroundTaskService`` to fetch and prepare the data
3. Add a new case to the ``prepareNlpInput()`` switch statement

To modify timeout or polling behavior:

1. Adjust ``intervalMs`` parameter in ``waitForNlpResult()`` (default 200ms)
2. Configure NLP service timeout in settings (typically 5-30 seconds)
3. Logs are written to the backend logger for debugging

To add support for mutiple table-based selections:
1. Modify ``InputFiles.vue`` to allow multi-parameter table selections
2. Update ``prepareProcessingItems()`` to compute Cartesian product (or other suitable combination) across multiple table-based selections;
Take care that this can generate arbitrarly large number of combinations, which might need some anchor points to limit the purpose and combinations
