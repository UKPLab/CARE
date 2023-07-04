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
        target-type="comment"
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

NLPService
----------

The NLPService component is a wrapper around the NLP service. It offers a simple way to use the NLP service.

TODO

Downloading
-----------
The different downloading components offer an easy way to manage the download of individual data points. Import the
suitable download component and provide the socket messages and IDs you want to download; the component takes care
of acquiring this data and pushing the result to the parent component upon completion. Use the export components if
the downloaded data should be exported in the browser.

TODO