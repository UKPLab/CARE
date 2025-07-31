Base Components
=================

CARE comes with a range of easy-to-use and function rich base components that you can find under
``frontend/src/basic``. Using these components ensures a consistent design throughout the application
and makes your live as a developer much easier.

In this brief chapter we outline the toolbox of basic components in a high-level fashion. For the details
of each base component, please refer to the documentation within each of them.


Card
-----
The card component offers a simple boostrap card with a title, body and footer. This is the go-to component
if you want to add information to dashboard components or in the annotator's sidebar.

You can use it by simply importing it and insert the headerElements, body and footer as template slots.

.. code-block:: html

    <BasicCard title='Example'>
        <template #headerElements>
        </template>
        <template #body>
        </template>
        <template #footer>
        </template>
    </BasicCard>


.. code-block:: javascript

    import BasicCard from '@/basic/Card.vue';

    export default {
        name: 'CardExample',
        components: {
            BasicCard,
        },
    };



.. list-table:: Card properties
    :header-rows: 1

    * - Prop
      - Description
      - Default
      - Type
    * - title
      - The title of the card
      - None
      - String
    * - collapsable
      - Whether the card is collapsable
      - False
      - Boolean
    * - collapsed
      - Whether the card should be collapsed by default
      - False
      - Boolean


Collaboration
-------------
Collaboration is a component that fully manages the synchronization necessary to realize collaborative features in
CARE. Simply import this component by a target type (e.g. a document) and id (e.g. the id of the document) to forward
a user's interaction to other clients (e.g. while editing an annotation).

.. note::

    Collaborative features are always based on a document.

.. code-block:: html

    <BasicCollaboration
        ref="collaboration"
        :target-id="commentId"
        target-type="comm(from backeent"
        :document-id="documentId"
        @collab-status="updateCollaboration"
    />

.. code-block:: javascript

    import BasicCollaboration from "@/basic/Collaboration.vue"

    export default {
        name: 'CollaborationExample',
        components: {
            BasicCollaboration,
        },
        data() {
            return {
                documentId: 1,
                collaboration: null,
            }
        },
        methods: {
            updateCollaboration(collaboration) {
                this.collaboration = collaboration;
            },
        },
    };

.. list-table:: Collaboration properties (all required!)
    :header-rows: 1

    * - Prop
      - Description
      - Default
      - Type
    * - target-type
      - The type of the target (e.g. the type of the comment)
      - None
      - String
    * - target-id
      - The id of the target (e.g. the id of the comment)
      - None
      - Number
    * - document-id
      - The id of the document
      - None
      - Number

Modal
-----

Import this component if you need a modal prompted to the user. You can customize the header, body and footer.

.. tip::

    Opening and closing of modals triggers statistics events. Additional data can be passed to the event by adding a
    ``props`` attribute to the modal. This data will be passed to the event.

.. code-block:: html

        <BasicModal
            name="Example"
            :props="{ 'example': 'data' }"
            @show="show"
            @hide="hide">
            <template #body>
                <p>Example body</p>
            </template>
            <template #footer>
                <button class="btn btn-primary" data-bs-dismiss="modal">Close</button>
            </template>
        </BasicModal>


.. code-block:: javascript


        import BasicModal from '@/basic/Modal.vue';

        export default {
            name: 'ModalExample',
            components: {
                BasicModal,
            },
            methods: {
                show() {
                    console.log('show modal');
                },
                hide() {
                    console.log('hide modal');
                },
            },
        };

.. list-table:: Modal properties
    :header-rows: 1

    * - Prop
      - Description
      - Default
      - Type
      - Required
    * - name
      - The name of the modal
      - None
      - String
      - True
    * - props
      - The props to pass for the statistics event
      - {}
      - Object
      - False
    * - autoOpen
      - Whether the modal should be opened automatically
      - False
      - Boolean
      - False
    * - removeClose
      - Whether the close button should be removed,
        | modal is only closable by keyboard
      - False
      - Boolean
      - False
    * - disableKeyboard
      - Disable the keyboard for closing the modal
      - False
      - Boolean
      - False
    * - lg
      - Whether the modal should be large
      - False
      - Boolean
      - False
    * - xl
      - Whether the modal should be extra large
      - False
      - Boolean
      - False

Multiple Modals
---------------

In certain workflows, you may need to display a modal *from within another modal*. For example, to add reviewers while assigning a document, or to edit nested content inside a form.

To prevent modals from stacking visibly or creating interaction conflicts, we support **modal swapping**, where the first modal is temporarily hidden and restored after the second modal closes.

.. tip::

    When a child modal is opened, the parent modal should be hidden using ``mainModal?.hide()``, and restored with ``mainModal?.show()`` when the child closes. This keeps the experience intuitive and avoids modal stacking issues.

**Example**

This example demonstrates how to temporarily hide one modal and show another, using `ref` and `inject`.

.. code-block:: html

    <!-- Parent Modal (e.g., Configuration) -->
    <BasicModal ref="parentModal" name="main-modal" @hide="onHide">
      <template #body>
        <button @click="openChild">Add Reviewer</button>
      </template>
    </BasicModal>

    <!-- Child Modal (e.g., Add Reviewer) -->
    <AddAssignmentModal ref="childModal" :main-modal="getParentModalRef()" />

.. code-block:: javascript

    methods: {
        openChild() {
            this.$refs.childModal.open(this.studyId);
        },
        getParentModalRef() {
            return this.$refs.parentModal;
        },
    }

.. code-block:: html

    <!-- AddAssignmentModal.vue -->
    <BasicModal
      ref="assignmentModal"
      name="add-assignment-modal"
      @hide="resetModal"
    >
      <template #title>
        <span>Add Reviewer</span>
      </template>
    </BasicModal>

.. code-block:: javascript

    inject: {
        mainModal: { default: null }
    },

    methods: {
        open(id) {
            this.$refs.assignmentModal.open();
            this.mainModal?.hide();  // hide parent
            this.studyId = id;
        },
        resetModal() {
            this.selectedReviewer = [];
            this.mainModal?.show();  // re-show parent
        },
    }

**Where It’s Used**

You can see this modal-handling approach in:

- ``dashboard/modal/AddAssignmentModal.vue``

StepperModal
------------

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

Advanced Use Case: Multi-Request Workflows with Progress Feedback
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The `StepperModal` is designed to support advanced workflows where multiple asynchronous requests are performed in a single step, and the user is informed about intermediate progress.

This is commonly used in Moodle integration scenarios (see: ``ImportModal.vue``) where:

- A progress bar is shown using ``startProgress()``
- A server emits partial updates using the returned `progressId`
- A loader is shown using ``setWaiting(true)``

.. code-block:: javascript

    handleStepZero() {
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

Where It Is Used
^^^^^^^^^^^^^^^^

You can find som usage examples of `StepperModal` in the following components:

- ``dashboard/modal/ReviewUploadModal.vue`` – A simple two-step modal for uploading documents.
- ``dashboard/modal/ConfigurationModal.vue`` – A dynamic modal to configure services and placeholders with step validation logic.
- ``dashboard/modal/ImportModal.vue`` – A multi-step modal that handles external data from Moodle, with live progress tracking and advanced backend interactions.

These can serve as reference implementations when building your own `StepperModal` flows.

Loader
------

If you need to fetch resources from the server or do computations that need more than a few milliseconds, you should
provide visual feedback to the user. The ``Loading`` component offers an easy-to-use standardized way of doing this.

Simply add it to your component template, usually within an if clause conditioned on the data to be loaded.

.. code-block:: html

    <Loading text="<loading_text>"></Loading>

.. code-block:: javascript

    import { Loading } from '@/basic/Loading.vue';

    export default {
        components: {
            Loading,
        },
    };

.. list-table:: Loading properties
    :header-rows: 1

    * - Prop
      - Description
      - Default
      - Type
      - Required
    * - text
      - The text to display
      - "Loading..."
      - String
      - False
    * - loading
      - Whether the loading should be displayed
      - True
      - Boolean
      - False

Icons
-----

All icons are based on `Bootstrap icons <https://icons.getbootstrap.com/>`_.

The icons are included as SVGs through the Icon.vue component. Simply add the component to your
template to load the respective icon. During actual loading of the icon, a loading symbol shows to ensure
proper spacing and usability.

.. code-block:: html

    <BasicIcon iconName="<bootstrap_icon_name>" size="<size in px>"/>

.. code-block:: javascript

    import BasicIcon from '@/basic/Icon.vue'

    export default {
        components: {
            BasicIcon
        }
    }

.. list-table:: Icon properties
    :header-rows: 1

    * - Prop
      - Description
      - Default
      - Type
      - Required
    * - iconName
      - The name of the icon
      - "IconQuestionCircle"
      - String
      - False
    * - size
      - The size of the icon
      - 16
      - Number
      - False
    * - color
      - The color of the icon
      - null
      - String
      - False

.. tip::

    Use 'loading' as the icon name to show a loading spinner.

.. note::

    The list of icons can also be found in /node_modules/bootstrap-icons/icons.

Timer
-----

This module provides timing utilities for countdowns. Provides emit events and supports different granularity.

.. code-block:: html

    <BasicTimer autostart show :resolution="1*1000" @timeStep="doSmth()" />

.. code-block:: javascript

    import BasicTimer from '@/basic/Timer.vue'

    export default {
        components: {
            BasicTimer
        },
        methods: {
            doSmth() {
                console.log('do something');
            },
        },
    }

.. list-table:: Timer properties
    :header-rows: 1

    * - Prop
      - Description
      - Default
      - Type
      - Required
    * - autostart
      - Whether the timer should start automatically
      - False
      - Boolean
      - False
    * - show
      - Whether the timer should be shown
      - False
      - Boolean
      - False
    * - resolution
      - The resolution of the timer in milliseconds
      - 60 * 1000
      - Number
      - False


Downloading
-----------

The different downloading components offer an easy way to manage the download of individual data points. Import the
suitable download component and provide the socket messages and IDs you want to download; the component takes care
of acquiring this data and pushing the result to the parent component upon completion. Use the export components if
the downloaded data should be exported in the browser.

Example for downloading a single data point:

.. code-block:: html

    <ExportSingle
        ref="export"
        name="stats"
        req-msg="statsGetAll"
        res-msg="statsData"
        :post-process="x => x.statistics"
    />

.. code-block:: javascript

    import ExportSingle from "@/basic/download/ExportSingle.vue";

    export default {
        components: {
            ExportSingle
        },
    }


.. list-table:: Export single properties
    :header-rows: 1

    * - Prop
      - Description
      - Default
      - Type
      - Required
    * - name
      - The name of the download
      - None
      - String
      - True
    * - req-msg
      - The socket message to request the data
      - None
      - String
      - True
    * - res-msg
      - The socket message to receive the data
      - None
      - String
      - True
    * - post-process
      - A function to post-process the data
      - None
      - Function
      - False

Choices
-------

TODO

