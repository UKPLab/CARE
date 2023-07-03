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

.. code-block:: xml

    <template>
        <BasicCard title='Example'>
            <template #headerElements>
            </template>
            <template #body>
            </template>
            <template #footer>
            </template>
        </BasicCard>
    </template>

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

.. code-block:: xml

    <template>
        <BasicCollaboration
            ref="collaboration"
            :target-id="commentId"
            target-type="comment"
            :document-id="documentId"
            @collab-status="updateCollaboration"
        />
    </template>

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

        <template>
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
        </template>

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

Table
-----
The table is the best way to visualize many rows of data. Simply pass the data rows to the table and specify the header.
Optionally, you may add button groups or selection boxes to each row. The table by default comes with a (frontend)
pagination feature and simple sorting for each column.

Form
----
To build forms, you can use the form component. It offers a simple way to build forms in a consistent way only by passing a dictionary.

Editor
------
The editor component is a wrapper around the `TipTap editor <https://tiptap.dev/>`_. It offers a simple way to build a rich text editor.

Downloading
-----------
The different downloading components offer an easy way to manage the download of individual data points. Import the
suitable download component and provide the socket messages and IDs you want to download; the component takes care
of acquiring this data and pushing the result to the parent component upon completion. Use the export components if
the downloaded data should be exported in the browser.
