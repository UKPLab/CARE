Plugins
=======

The ``frontend/src/plugins`` folder provides **self-contained helpers** that extend CARE’s
frontend with specialized functionality. Plugins are not basic UI components, but rather
small building blocks that encapsulate logic and can be reused across modals, forms,
and dashboards.

SubscribeTable Plugin
---------------------

The **Realtime Subscription Plugin** connects a component to CARE’s **live data** pipeline with one
declarative option: ``subscribeTable``. On mount it subscribes the component to one or
more backend **autoTables**; the server then pushes ``<tableName>Refresh`` events that
Vuex merges. On unmount the plugin automatically unsubscribes.

For the complete end-to-end flow (Sockets ↔ Vuex ↔ Components), see
:doc:`Data Transfer <../backend/data_transfer>`.

Moodle Options Plugin
---------------------

The **MoodleOptions** plugin wraps a :doc:`Basic Form <../frontend/basic/form>` to collect
Moodle connection parameters and, optionally, an assignment ID. It is used inside
:doc:`StepperModal <../frontend/basic/modal>` workflows such as:

- Importing submissions from Moodle
- Publishing review links
- Bulk user creation with upload to Moodle

Example usage:

.. code-block:: html

   <MoodleOptions
     ref="moodleOptionsForm"
     v-model="moodleOptions"
     with-assignment-id
   />

Field visibility and defaults are driven by admin settings (``rpc.moodleAPI.*``).
Assignment IDs can be fetched live from Moodle via a ``Refresh`` button, which triggers
a backend request (``assignmentGetInfo``).