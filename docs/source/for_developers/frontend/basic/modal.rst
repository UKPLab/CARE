Modal
=====

This section summarizes the modal components available in CARE, when to use them, and their key APIs.  
All of them are built on top of :ref:`BasicModal <modal>` and support open/close via a template ref.

.. _lazy-loading-modals:

Lazy-Loading Modals
-------------------

Modals that use ``subscribeTable`` run ``subscribeAppData`` on mount. If all modals are always rendered, every subscription fires on page load, even for modals the user never opens. On large databases this causes the browser to freeze.

Use ``v-if`` to defer mounting until the modal is actually needed, and **unload on close** (reset the flag in ``@hide``) so the modal unmounts and its subscriptions are released. All top-level modals in dashboard pages should use this pattern for consistency and performance.

.. tip::

    Apply this pattern to **top-level** modals only (those rendered directly in a dashboard page).
    Nested modals (children rendered inside a parent modal) should stay always-rendered so they are
    available immediately when the parent is open.

**Pattern**

1. Declare a reactive ``modals`` object with a boolean flag per modal.
2. Guard each modal with ``v-if``.
3. Open via a method that sets the flag, then calls ``open()`` in ``$nextTick``.
4. Listen for ``@hide`` and reset the flag so the modal unmounts.

.. code-block:: html

    <template>
      <!-- button triggers the open method -->
      <button @click="openUploadModal">Upload</button>

      <!-- modal mounts only when needed, unmounts on close -->
      <UploadModal
          v-if="modals.upload"
          ref="uploadModal"
          @hide="modals.upload = false"
      />
    </template>

.. code-block:: javascript

    export default {
      data() {
        return {
          modals: {
            upload: false,
          },
        };
      },
      methods: {
        openUploadModal() {
          this.modals.upload = true;
          this.$nextTick(() => this.$refs.uploadModal?.open());
        },
      },
    };

.. note::

    ``$nextTick`` is required because Vue needs one tick to mount the component after the flag
    becomes ``true``. Optional chaining (``?.``) guards against the rare case where the ref is not
    yet available.

.. note::

    When a lazy-loaded modal is closed and unmounted, all internal state (form data, selections,
    step progress) is destroyed. Most modals already reset on ``open()``, so this is safe.
-----

`StepperModal`

Import this component if you need a modal that guides users through a sequence of steps, with validation and feedback.
Ideal for configuration workflows, uploads, or integrations like Moodle (see :ref:`usage section <steppermodal-usage>`).

.. tip::

    `StepperModal` supports per-step validation and can also be connected to socket events for multi-step backend processes
    with progress tracking and user feedback.

**Usage Example**

.. code-block:: html

    <StepperModal
        ref="uploadStepper"
        :steps="steps"
        :validation="stepValid"
        @submit="uploadDocument"
    >
        <template #title>
            <h5 class="modal-title">Upload Assignment</h5>
        </template>

        <template #step-1>
            <BasicTable
                v-model="selectedUser"
                :columns="selectionTable"
                :options="selectionTableOptions"
                :data="users" />
        </template>

        <template #step-2>
            <BasicForm
                v-model="data"
                :fields="fileFields" />
        </template>
    </StepperModal>

.. code-block:: javascript

    import StepperModal from '@/basic/modal/StepperModal.vue';

    export default {
        name: 'ReviewUploadModal',
        components: {
            StepperModal,
        },
        data() {
            return {
                steps: [
                    { title: 'Select User' },
                    { title: 'Upload File' },
                ],
                selectedUser: [],
                data: {},
            };
        },
        computed: {
            stepValid() {
                return [
                    this.selectedUser.length > 0,
                    this.data.file !== null,
                ];
            },
        },
        methods: {
            uploadDocument() {
                // handle document upload
            },
        },
    };

**Component Properties:** `StepperModal` requires two essential props: ``steps`` and ``validation``. These drive the navigation and determine if each step is allowed to proceed.

.. list-table:: StepperModal properties
    :header-rows: 1

    * - Prop
      - Description
      - Default
      - Type
      - Required
    * - steps
      - List of step definitions (must include ``title``)
      - None
      - Array
      - True
    * - validation
      - Array of boolean values indicating if each step is valid
      - []
      - Array
      - True
    * - submitText
      - Text for the final submit button
      - "Submit"
      - String
      - False

.. note::

    The number and order of elements in ``validation`` must match the number of items in ``steps``.  
    Whenever possible, ``validation`` should be provided via a computed property to ensure it stays in sync automatically.

**Slots:** Each step must have a corresponding named slot using the syntax ``#step-n`` where ``n`` is the 1-based index. You can also customize the modal's title and footer.

.. list-table:: StepperModal slots
    :header-rows: 1

    * - Slot
      - Description
    * - ``#title``
      - Header section of the modal
    * - ``#step-n``
      - Content for step `n`, e.g. ``#step-1``, ``#step-2``
    * - ``#error``
      - Optional error view if something goes wrong
    * - ``#footer``
      - Optional custom footer. Use this to override default button layout

**Events:** StepperModal emits lifecycle and state events:

.. list-table:: StepperModal events
    :header-rows: 1

    * - Event
      - Description
    * - ``@submit``
      - Triggered on the final step when the user clicks submit
    * - ``@step-change``
      - Triggered whenever the step index changes
    * - ``@hide``
      - Emitted when modal is hidden

**Public Methods (via `ref`):** You can interact with the modal directly via its ref (e.g., ``this.$refs.uploadStepper``).

.. list-table:: StepperModal methods
    :header-rows: 1

    * - Method
      - Description
    * - ``open()``
      - Opens the modal and resets to the first step
    * - ``close()``
      - Closes the modal
    * - ``show()``
      - Displays the modal without resetting the step
    * - ``hide()``
      - Hides the modal (soft close)
    * - ``reset()``
      - Resets step to index 0
    * - ``setWaiting(true|false)``
      - Toggles a loading indicator on the modal
    * - ``startProgress()``
      - Starts an animated progress bar (used during backend jobs)
    * - ``stopProgress()``
      - Stops the progress bar
    * - ``getProgressId()``
      - Returns a progress identifier to be sent with socket events

**Advanced Use Case: Multi-Request Workflows with Progress Feedback**

The `StepperModal` is designed to support advanced workflows where multiple asynchronous requests are performed in a single step, and the user is informed about intermediate progress.

This is commonly used in Moodle integration scenarios (see: ``ImportModal.vue``) where:

- A progress bar is shown using ``startProgress()``
- A server emits partial updates using the returned `progressId`
- A loader is shown using ``setWaiting(true)``

.. code-block:: javascript

    handleStepOne() {
        this.$refs.importStepper.setWaiting(true);
        this.$socket.emit("documentGetMoodleSubmissions", { options: this.moodleOptions }, (res) => {
            this.$refs.importStepper.setWaiting(false);
            if (!res.success) {
                this.$refs.importStepper.reset();
                this.eventBus.emit("toast", {
                    title: "Failed",
                    message: res.message,
                    variant: "danger",
                });
            }
        });
    }

    handleStepTwo() {
        this.$socket.emit("documentDownloadMoodleSubmissions", {
            files: this.selectedAssignments,
            options: this.moodleOptions,
            progressId: this.$refs.importStepper.startProgress(),
        }, (res) => {
            this.$refs.importStepper.stopProgress();
            if (res.success) {
                this.importedAssignments = res["data"];
            } else {
                this.eventBus.emit("toast", {
                    title: "Failed to import submission from Moodle",
                    message: res.message,
                    variant: "danger",
                });
            }
        });
    }

.. tip::

    This feature is especially useful for bulk operations like:

    - Importing files or documents
    - Creating or updating users
    - Interacting with external APIs that return partial responses (e.g., Moodle)

.. _steppermodal-usage:

**Where It Is Used**

You can find som usage examples of `StepperModal` in the following components:

- ``dashboard/modal/ReviewUploadModal.vue`` – A simple two-step modal for uploading documents.
- ``dashboard/modal/ConfigurationModal.vue`` – A dynamic modal to configure services and placeholders with step validation logic.
- ``dashboard/modal/ImportModal.vue`` – A multi-step modal that handles external data from Moodle, with live progress tracking and advanced backend interactions.

These can serve as reference implementations when building your own `StepperModal` flows.

-----

`ConfigurationModal`

- **What it is:** A specialized modal that guides the user through service and placeholder configuration.  
- **Use it for:** NLP service setup, linking inputs/outputs, and mapping placeholders inside study workflows.  

It is built on top of :ref:`StepperModal <steppermodal-usage>`, adding two predefined steps:

1. **Services** – Select NLP skills for each service and configure their inputs.  
2. **Placeholders** – Bind placeholders (``~text~``, ``~chart~``, ``~comparison~``) to actual data sources.

**Usage Example**

.. code-block:: html

    <ConfigurationModal
        v-model="configData"
        :document-id="documentId"
        :study-step-id="stepId"
        :workflow-steps="steps"
        ref="configModal"
    />

.. code-block:: javascript

    import ConfigurationModal from '@/basic/modal/ConfigurationModal.vue';

    export default {
        components: { ConfigurationModal },
        data() {
            return {
                documentId: 42,
                stepId: 3,
                steps: [...],
                configData: {}
            };
        },
        methods: {
            openConfig() {
                this.$refs.configModal.openModal();
            }
        }
    };

**API:**  

- ``openModal(evt)`` – Opens the modal if a document is selected.  
- ``close()`` – Closes the modal.  
- Emits ``update:modelValue`` with the assembled configuration object.

The modal also shows **short previews** of placeholders with colored highlights and validates that all inputs are properly bound before submission.

-----

`ConfigurationPlaceholder`

- **What it is:** A helper component rendered inside ConfigurationModal for editing individual placeholders.  
- **Use it for:** Providing per-placeholder input fields (e.g., select NLP skill, map outputs, enter labels).  

**Props:**  

- ``placeholder`` – The placeholder metadata (type, number).  
- ``fields`` – List of input fields to render.  
- ``index`` – Position of the placeholder.  
- ``formData`` – Reactive object bound to the user’s selections.  
- ``placeholderColor`` – Display color for consistent previews.  

**Usage Example**

.. code-block:: html

    <ConfigurationPlaceholder
        :placeholder="placeholder"
        :fields="fieldDefs"
        :index="i"
        v-model="formData[i]"
        :placeholder-color="colors[i]"
    />

This component integrates with Vuex-provided NLP skills and ensures placeholders are configured consistently across steps.

-----

`ConfirmModal`

- **What it is:** A ready-to-use confirmation dialog.  
- **Use it for:** Destructive actions (delete, reset) or explicit user confirmation.

**Usage Example**

.. code-block:: html

    <ConfirmModal ref="confirmModal" />

.. code-block:: javascript

    this.$refs.confirmModal.open(
        this.$t('users.messages.deleteTitle'),
        this.$t('users.messages.deleteConfirm'),
        null,
        (res) => console.log("Confirmed:", res)
    );

Footer buttons use ``$t('common.abort')`` and ``$t('common.confirm')``. Pass already-translated
``title``, ``message``, and ``warning`` into ``open()``. ``warning`` is plain text, not HTML, so
newlines do not break lines.

**API:** ``open(title, message, warning?, callback)``; emits ``@response`` with ``true/false``.  

-----

`ConsentUpdateModal`

- **What it is:** A user consent update dialog.  
- **Use it for:** Asking users to confirm data sharing and statistics collection.  

**Usage Example**

.. code-block:: html

    <ConsentUpdateModal ref="consentModal" />

.. code-block:: javascript

    this.$refs.consentModal.open();

-----

`InformationModal`

- **What it is:** A read-only, nicely formatted detail view for an object.  
- **Use it for:** Inspecting row details from a table, showing metadata, etc.  

**Usage Example**

.. code-block:: html

    <InformationModal ref="info" />

.. code-block:: javascript

    this.$refs.info.open({ username: "alice", role: "admin" });

**API:** ``open(data)``, ``close()``.  
**Rendering:** Formats keys (camelCase / snake_case → labels) and prints nested objects as labeled lists.

-----

`PasswordModal`

- **What it is:** A small form-in-a-modal for updating a user’s password.  
- **Use it for:** Admin or account flows where a single field must be validated and submitted.  

**Usage Example**

.. code-block:: html

    <PasswordModal ref="pwdModal" />

.. code-block:: javascript

    this.$refs.pwdModal.open(userId);
