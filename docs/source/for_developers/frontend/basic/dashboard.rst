Dashboard
---------

**Card**

The card component offers a simple bootstrap card with a title, body and footer. This is the go-to component
if you want to add information to dashboard components or in the annotator's sidebar.

You can use it by simply importing it and inserting the headerElements, body and footer as template slots.

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

    import BasicCard from '@/basic/dashboard/card/Card.vue';

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


**DashboardListPage**

Shared shell for a dashboard list page: a card wrapping ``BasicTable``. Import from
``@/basic/dashboard/ListPage.vue``. How to wire columns, row buttons, filters, and soft delete
on a dashboard page: :doc:`../components/dashboard`.

.. code-block:: html

    <DashboardListPage
      :title="$t('tags.title')"
      :columns="columns"
      :data="tagSets"
      :buttons="buttons"
      @action="action"
    >
      <template #headerActions>
        <!-- header buttons -->
      </template>
    </DashboardListPage>

.. code-block:: javascript

    import DashboardListPage from "@/basic/dashboard/ListPage.vue";

    export default {
      name: "DashboardTags",
      components: { DashboardListPage },
    };

.. list-table:: DashboardListPage properties
   :header-rows: 1

   * - Prop
     - Description
     - Default
     - Type
     - Required
   * - title
     - Card title. Pass ``$t('…')`` (see :doc:`../../i18n`)
     - None
     - String
     - True
   * - columns
     - ``BasicTable`` column definitions
     - None
     - Array
     - True
   * - data
     - ``BasicTable`` row data
     - None
     - Array
     - True
   * - buttons
     - Row-action buttons (manage column)
     - ``[]``
     - Array
     - False
   * - tableOptions
     - Merged onto ``DEFAULT_DASHBOARD_TABLE_OPTIONS`` from ``constants.js``
     - ``null`` (use the defaults)
     - Object
     - False
   * - maxTableHeight
     - Passed to ``BasicTable``
     - ``DASHBOARD_TABLE_HEIGHT`` (``"65vh"``)
     - String or Number
     - False

.. list-table:: DashboardListPage events & slots
   :header-rows: 1

   * - Name
     - Type
     - Description
   * - ``@action``
     - event
     - Forwarded from ``BasicTable``
   * - ``#headerActions``
     - slot
     - Header buttons (``Tags.vue``, ``Projects.vue``, …)
   * - ``#afterTable``
     - slot
     - Extra UI under the table, inside the card body (``Documents.vue``)

Row-button helpers and ``confirmSoftDelete`` live in ``frontend/src/basic/dashboard/actions.js``.
``withSearch(options)`` lives in ``constants.js``. It returns the default table options with
``search: true``. Extra ``options`` are merged on top of the defaults, they do not replace them.

**Coordinator**

The coordinator wraps a :ref:`Form <form-section>` inside a modal to **add/edit** backend entries.  
It pulls field definitions from the Vuex store (``table/<name>/getFields``; see :doc:`../vuex_store`), applies optional read-only flags, and handles submit/save + success UI.

.. code-block:: html

    <BasicCoordinator
      ref="coordinator"
      table="study"
      :title="$t('studies.study')"
      @success="success"
      @submit="submit">
      <template #title> <!-- optional custom title --> </template>
      <template #success> <!-- overwrite success message --> </template>
      <template #success-footer> <!-- footer after success --> </template>
      <template #buttons> <!-- extra footer buttons --> </template>
    </BasicCoordinator>

.. code-block:: javascript

    import BasicCoordinator from "@/basic/dashboard/Coordinator.vue";

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
     - Used as ``{item}`` in the New/Edit heading (``$t('common.newItem')`` / ``$t('common.editItem')``)
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
     - Add-button label. Leave empty to use ``$t('common.add')``
     - ``""``
     - String
     - False
   * - textUpdate
     - Update-button label. Leave empty to use ``$t('common.update')``
     - ``""``
     - String
     - False
   * - textCancel
     - Cancel-button label. Leave empty to use ``$t('common.cancel')``
     - ``""``
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