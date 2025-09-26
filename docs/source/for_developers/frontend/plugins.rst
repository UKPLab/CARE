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