Basic
=====

CARE comes with a range of easy-to-use and function rich base components that you can find under
``frontend/src/basic``. Using these components ensures a consistent design throughout the application
and makes your live as a developer much easier.

In this brief chapter we outline the toolbox of basic components in a high-level fashion. For the details
of each base component, please refer to the documentation within each of them.

Code Structure Overview
------------------------

Below are the **folders** you’ll find first under ``frontend/src/basic``.  
Each entry links to its detailed documentation. Further down on this page, you’ll find the **single-file base components**.
This structure mirrors the actual code layout.

.. toctree::
   :maxdepth: 2

   download
   editor
   form
   icon
   modal
   navigation
   table
   service

-----

Button
------
The button component provides a consistent wrapper around the native ``<button>`` element with support for
labels, optional icons (see `Bootstrap Icons <https://icons.getbootstrap.com>`_), and integrated statistics events (see :doc:`../stats` ). Use it in modals, forms, or dashboards to keep actions
consistent across CARE.

.. code-block:: html

    <BasicButton
        class="btn btn-primary"
        title="Confirm"
        icon="check2"
        @click="submit"
    />

.. code-block:: javascript

    import BasicButton from '@/basic/Button.vue';

    export default {
        name: 'ButtonExample',
        components: {
            BasicButton,
        },
        methods: {
            submit() {
                console.log('confirmed');
            }
        }
    };

.. list-table:: Button properties
    :header-rows: 1

    * - Prop
      - Description
      - Default
      - Type
    * - title
      - Button tooltip and fallback label
      - None
      - String
    * - text
      - Visible button label (if not set, ``title`` is used)
      - None
      - String
    * - icon
      - Optional icon name (see :doc:`Icon <icon>`)
      - None
      - String
    * - props
      - Extra payload for statistics events
      - None
      - Object

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
CARE. Simply import this component by a target type (e.g. a :doc:`../components/editor` document or an :doc:`../components/annotator` comment) and id (e.g. the id of the document) to forward
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

Coordinator
-----------

The coordinator wraps a :ref:`Form <form-section>` inside a modal to **add/edit** backend entries.  
It pulls field definitions from the Vuex store (``table/<name>/getFields``; see :doc:`../vuex_store`), applies optional read-only flags, and handles submit/save + success UI.

.. code-block:: html

    <BasicCoordinator
      ref="coordinator"
      table="study"
      title="Study"
      @success="success"
      @submit="submit">
      <template #title> <!-- optional custom title --> </template>
      <template #success> <!-- overwrite success message --> </template>
      <template #success-footer> <!-- footer after success --> </template>
      <template #buttons> <!-- extra footer buttons --> </template>
    </BasicCoordinator>

.. code-block:: javascript

    import BasicCoordinator from "@/basic/Coordinator.vue";

    export default {
      components: { BasicCoordinator },
      methods: {
        success(id) { console.log("Saved id:", id); },
        submit(data) { console.log("Submit:", data); }
      }
    };

.. list-table:: Coordinator properties
   :header-rows: 1

   * - Prop
     - Description
     - Default
     - Type
     - Required
   * - table
     - Vuex table namespace to manage (loads ``fields``)
     - None
     - String
     - True
   * - title
     - Modal title (shown as *New/Edit + title*)
     - None
     - String
     - True
   * - defaultValue
     - Default values for new entries
     - ``{}``
     - Object
     - False
   * - readOnlyFields
     - Array of field keys to mark ``readOnly``
     - ``[]``
     - Array
     - False
   * - textAdd
     - Label for add button
     - ``"Add"``
     - String
     - False
   * - textUpdate
     - Label for update button
     - ``"Update"``
     - String
     - False
   * - textCancel
     - Label for cancel button
     - ``"Cancel"``
     - String
     - False

.. list-table:: Coordinator events & slots
   :header-rows: 1

   * - Name
     - Type
     - Description
   * - ``@submit``
     - event
     - Emits form data before saving
   * - ``@success``
     - event
     - Emits saved id on success
   * - ``#title``, ``#success``, ``#success-footer``, ``#buttons``, ``#footer``
     - slots
     - Optional UI customizations

.. tip::
   Use ``this.$refs.coordinator.open(id?, defaultValues?, copy?)`` to open the modal and prefill values.  
   Validation + per-step config checks are delegated to the inner :doc:`Form <form>`.

.. _form-section:

Form
----

Renders a dynamic form from a **fields** description and two-way binds data via ``v-model``.  
Includes per-field validation, default values, and specialized inputs (switch, slider, select, checkbox, editor/html, textarea, table, choice, password, file, default).

.. code-block:: html

    <BasicForm
      ref="form"
      v-model="data"
      :fields="fields"
      @update:config-status="handleConfigStatusChange"
    />

.. code-block:: javascript

    import BasicForm from "@/basic/Form.vue";

    export default {
      components: { BasicForm },
      data: () => ({ data: {}, fields: [] }),
      methods: {
        handleConfigStatusChange(s) { console.log("config:", s); },
        save() { if (this.$refs.form.validate()) {/* submit */} }
      }
    };

.. list-table:: Form properties
   :header-rows: 1

   * - Prop
     - Description
     - Default
     - Type
     - Required
   * - ``modelValue``
     - Two-way bound data object
     - None
     - Object
     - True
   * - ``fields``
     - Array of field descriptors (type, key, defaults, etc.)
     - None
     - Object/Array
     - True

.. list-table:: Form events & methods
   :header-rows: 1

   * - Name
     - Type
     - Description
   * - ``@update:modelValue``
     - event
     - Emits when internal data changes
   * - ``@update:config-status``
     - event
     - Emits config state (e.g., ``{ hasIncompleteConfig, incompleteSteps }``)
   * - ``validate()``
     - method (via ``ref``)
     - Returns ``true`` if all visible fields validate

**Supported field types:** ``switch``, ``slider``, ``datetime``, ``select``, ``checkbox``, ``editor``/``html``, ``textarea``, ``table``, ``choice``, ``password``, ``file``, and a *default* HTML input fallback.

.. note::
   The form auto-applies ``default`` values from ``fields`` and preserves ``id`` if present.  
   For detailed field options and type-specific properties, see the full :doc:`Form <form>`.

Icon
----

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

    For details on the underlying components (**IconAsset**, **IconBootstrap**, **IconLoading**) and when to use them directly,
    see the dedicated :doc:`Icon page <./icon>`.

Loading
-------

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

.. _modal:

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

.. _table:

Table
-----

The table component renders data using a declarative ``columns`` description and flexible ``options`` (sorting, filtering, search, selection, pagination). Use it for consistent, feature-rich data grids.

.. code-block:: html

    <BasicTable
        :columns="columns"
        :data="rows"
        :options="options"
        :buttons="buttons"
        @action="onAction"
    />

.. code-block:: javascript

    import BasicTable from '@/basic/Table.vue';

    export default {
      components: { BasicTable },
      data() {
        return {
          options: { striped: true, hover: true, pagination: 10, search: true },
          columns: [
            { name: 'Title', key: 'name', sortable: true },
            { name: 'Created', key: 'createdAt', type: 'datetime' },
            { name: 'Manage', key: 'manage', type: 'button-group' },
          ],
          rows: [],
          buttons: [
            { title: 'Edit', action: 'edit', icon: 'pencil' },
            { title: 'Delete', action: 'delete', icon: 'trash' },
          ],
        };
      },
      methods: {
        onAction(payload) { console.log(payload.action, payload.params); },
      }
    };

.. list-table:: Table properties
   :header-rows: 1

   * - Prop
     - Description
     - Default
     - Type
   * - ``columns``
     - Column config (name, key, type, sortable, filter, …)
     - None
     - Array (required)
   * - ``data``
     - Row data
     - ``[]``
     - Array
   * - ``options``
     - Behavior/styling (striped, hover, pagination, search, selectableRows, singleSelect, sort, …)
     - ``{}``
     - Object
   * - ``buttons``
     - Extra per-row actions shown in a rightmost column
     - ``[]``
     - Array
   * - ``modelValue``
     - Selected rows (when ``selectableRows`` is enabled)
     - ``{}``
     - Object
   * - ``count``
     - External count (for server-side pagination)
     - ``0``
     - Number

.. list-table:: Events
   :header-rows: 1

   * - Event
     - Payload
     - Description
   * - ``@action``
     - ``{ action, params, stats? }``
     - Emitted by buttons/toggles/icon selectors
   * - ``@update:modelValue``
     - Selected rows
     - Emitted when selection changes
   * - ``@paginationUpdate``
     - ``{ page, limit, order, filter }``
     - For server-side pagination

For the full API (types, filters, client/server pagination), see :doc:`Table <table>`.

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

.. _toasts:

Toast
-----

To provide users feedback to their actions, consider using the `toast messaging <https://bootstrap-vue.org/docs/components/toast>`_
functionality integrated in CARE. A toast message is a simple message prompted in the viewport of the user without
obstructing their view and workflow.

**Toasting in the Frontend**

To create such a prompt from anywhere in the application, you simply put a ``toast`` message on the eventbus of the
application:

.. code-block:: javascript

    this.eventBus.emit('toast', {title: "title", message: "Message", variant: "warning", delay: 3000});

This produces a toast with the title 'title' and showing the short message 'Message' for 3000ms before disappearing
again. By providing the ``variant`` attribute as either of the `boostrap badge color <https://getbootstrap.com/docs/5.0/components/badge/#pill-badges>`_
keywords, you can define the color of the prompt. For consistency, you should use the badge types consistently to their
semantics; e.g. use the "danger" keyword for errors.

**Toasting from the Backend**

In case you want to provide direct feedback from the backend to the user, e.g. in case of a server error upon a given
request, you can also use the ``Socket`` class' ``sendToast`` method:

.. code-block:: javascript

    this.sendToast("Example Error Title", "Example Error Message", "danger");

