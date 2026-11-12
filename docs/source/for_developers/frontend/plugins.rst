Plugins
=======

The ``frontend/src/plugins`` folder provides **self-contained helpers** that extend CARE’s
frontend with specialized functionality. For general background on plugins in Vue, see the
`official Vue documentation <https://vuejs.org/guide/reusability/plugins>`_.

SubscribeTable Plugin
---------------------

The **Realtime Subscription Plugin** connects a component to CARE’s **live data** pipeline with one
declarative option: ``subscribeTable``. On mount it subscribes the component to one or
more backend **autoTables**; the server then pushes ``<tableName>Refresh`` events that
Vuex merges. On unmount the plugin automatically unsubscribes.

For the complete end-to-end flow (Sockets ↔ Vuex ↔ Components), see
:doc:`Data Transfer <../backend/data_transfer>` and :doc:`Vuex Store <../frontend/vuex_store>`.

**Dashboard pages and lazy-loaded modals**

Top-level dashboard views that use :ref:`lazy-loading modals <lazy-loading-modals>` should still
include every auto table the **page itself** needs on first render (for example ``"user"`` when
the table shows names from ``table/user``). Lazy-loaded modals are not mounted until opened, so
``subscribeTable`` on those modals does not run on the initial dashboard load. Relying on modals
alone would leave the related Vuex stores empty until the user opens a modal.

**Examples**

Minimal subscription (e.g., in ``Documents.vue``):

.. code-block:: javascript

   export default {
     subscribeTable: ["document", "study"],
     computed: {
       documents() {
         return this.$store.getters["table/document/getAll"];
       }
     }
   }

Advanced subscription with filters and injects (e.g., in ``SingleAssignmentModal.vue``):

.. code-block:: javascript

   export default {
     subscribeTable: [
       {
         table: "document",
         filter: [{ key: "readyForReview", value: true }],
       },
       {
         table: "user",
         inject: [{
           table: "study_session",
           by: "userId",
           type: "count",
           as: "studySessions"
         }]
       },
       {
         table: "study",
         filter: [{ key: "template", value: true }]
       }
     ],
     computed: {
       documents() {
         return this.$store.getters["table/document/getFiltered"](d => d.readyForReview);
       },
       reviewers() {
         return this.$store.getters["table/user/getAll"];
       }
     }
   }

SelectEnhancer Plugin
---------------------

The **SelectEnhancer Plugin** (``selectEnhancer.js``, registered in ``main.js``) replaces the
browser-drawn list of every native ``<select>`` with a CARE-styled popup, so selects look the same in
every browser and theme. The ``<select>`` element itself stays in place: its value, ``v-model`` and
``change`` events work as before, so no component needs to opt in.

The popup reuses the keyboard handling and positioning of ``basic/form/listbox.js``, shared with
the form Select and ``FilterDropdown.vue``. Its look is the ``.care-native-menu`` section in ``global.css``.
