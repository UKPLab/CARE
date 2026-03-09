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


**Coordinator**

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