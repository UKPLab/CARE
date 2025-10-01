Vuex Store
==========

The vuex store is the central memory accessible across all components of the frontend application. Additionally, the
store is responsible for managing data updates coming from the backend socket interface. Most of your use cases should
be covered by the existing store, but in case you add new socket messages you have to extend it.

Store Structure
---------------
The store is structured into modules and auto tables from backend.
Modules can be found in the folder ``frontend/src/store/modules`` and are special tables used in the frontend.
Auto tables are tables that are automatically generated from the backend and offers a standard way to access the data.

.. note::

    The vuex store is not persistent; i.e. reloading the webpage in the browser discards the store and forces
    reloading of the data from the backend, see :doc:`../backend/data_transfer`.

.. tip::
    Checkout the vuex store documentation here: `Vuex Guide <https://vuex.vuejs.org/guide/>`_.


Accessing the Store
-------------------
To access the store, you can simply use the following line of code within your component:

.. code-block:: javascript

    this.$store.getters["table/<auto_table_name>/get"](<id>)

Here the getter ``get`` of an auto table is loaded passing the id of the data entry. The resulting
list can be further processed according to the needs of the respective component.

Auto tables
-----------
Auto tables are tables that are automatically generated from the backend and offers a standard way to access the data.
Auto tables are simple copies of the backend tables filtered by the access rights of the respective user.
To allow a database table to be used as an auto table, the model description ``./backend/db/models/<table>.js`` in the backend has to be extended by the
key ``static autoTable = true;``. It is also possible to publish a complete table to everyone by setting ``static publicTable = true;``.

.. tip::

    To edit data for auto tables, we recommend to use the basic :doc:`form component <basic/form>`.

.. seealso::
   For subscription setup and how socket refreshes update the store, see
   :doc:`Data Transfer <../backend/data_transfer>`.

Loading Data for Auto Tables
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

To load data for auto tables, we provide a plugin that automatically loads the data from the backend. To use the plugin,
you have to add a simple option ``fetchData`` with a list of the tables to the component definition.
For live updates without manual reloads, combine with the :doc:`SubscribeTable plugin <../plugins>` (``subscribeTable`` option).

.. code-block:: javascript

    export default {
        name: "MyComponent",
        fetchData: ["<auto_table_name>"],
        ...
    }

Supported Getters
~~~~~~~~~~~~~~~~~

The following getters are supported for auto tables:

- ``get``: Returns a object by a given id.
- ``getAll``: Returns a list of all objects.
- ``getFiltered``: Returns a list of objects filtered by a given filter function.
- ``getByHash``: Returns a object by a given hash, if hash column is defined in table.
- ``getByUser``: Returns a list of objects filtered by a provided user id, if userId column is defined in table.
- ``getByKey``: Returns a object by a given key, if key column is defined in table.
- ``length``: Returns the number of objects in the table.
- ``countByKey``: Returns the number of objects in the table by a given key and value. You can also pass a ``hierarchical`` flag to count all objects with the given key and value or any of its children.
- ``hasFields``: Returns true if the table has a fields definition defined in the backend (used for :doc:`basic/form`).
- ``getFields``: Returns the fields definition defined in the backend (used for :doc:`basic/form`), if available (check before with hasFields).
- ``refreshCount``: Returns the count how often the data was refreshed from the backend.

Live Updates via Subscriptions
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

For **real-time** updates (no manual reload), components can subscribe to auto tables.
Use the frontend plugin option ``subscribeTable`` to establish a socket subscription. On mount,
the plugin emits ``subscribeAppData``; on unmount, it sends ``unsubscribeAppData``. The backend
then broadcasts ``<tableName>Refresh`` events that update the Vuex module.

.. code-block:: javascript

   export default {
       name: "MyComponent",
       subscribeTable: ["document", "study"],  // keep this table live-synced
       // ...
   }

.. tip::
   If your project still uses ``fetchData`` for initial loads, you can use **both**:
   ``fetchData`` for the first snapshot and ``subscribeTable`` for ongoing updates.

For the full backend–frontend pipeline (sockets, broadcasts, refresh logic), see :doc:`Data Transfer <../backend/data_transfer>`.

