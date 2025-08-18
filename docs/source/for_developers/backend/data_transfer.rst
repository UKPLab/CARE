Data Transfer
=============

CARE implements a **data subscription mechanism** between the backend and the frontend, enabling
real-time collaboration and automatic synchronization of database tables with the Vuex store
in the frontend application.

.. _data-transfer:

Overview of Data Subscription
----------------------------

When a database model in CARE defines the attribute ``autoTable = true``, it becomes
*subscribable*. Subscribable tables are automatically mirrored into the Vue frontend
store. Once a component in the frontend subscribes to such a table, the backend
ensures that:

- The initial data is sent when the component is mounted  
- All updates (create, update, delete) to the table are pushed via sockets  
- Only data the user is allowed to access (according to access rights) is transferred  

This allows components to always work with the **latest state of the database** without
manual refresh calls.

Frontend Subscription
~~~~~~~~~~~~~~~~~~~~~

Subscriptions are handled by the Vue plugin ``subscribeTable.js``.  
This plugin emits socket events when a subscribing component is mounted and
cleans up the subscription when the component is unmounted.

.. code-block:: javascript

    export default {
        install: (app, options = {namespace: "table"}) => {
            app.mixin({
                data() {
                    return { subscriptionId: null }
                },
                mounted() {
                    if (this.$options.subscribeTable) {
                        this.$options.subscribeTable.forEach((table) => {
                            if (typeof table !== "object") {
                                table = { table: table };
                            }
                            this.$socket.emit("subscribeAppData", table, (result) => {
                                if (result.success) {
                                    this.$data.subscriptionId = result.data;
                                }
                            });
                        });
                    }
                },
                unmounted() {
                    if (this.$data.subscriptionId) {
                        this.$socket.emit("unsubscribeAppData", this.$data.subscriptionId);
                        this.$data.subscriptionId = null;
                    }
                }
            })
        }
    }

Using `subscribeTable` in a Component
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Any Vue component can declare a ``subscribeTable`` option to indicate which
tables it needs data from. For example, the **Dashboard** view subscribes to
the ``nav_element`` table:

.. code-block:: javascript

    export default {
        name: "DashboardRoute",
        subscribeTable: ["nav_element"],
        components: { Loading, Sidebar },
        computed: {
            navElements() {
                return this.$store.getters["table/nav_element/getAll"];
            },
            settings() {
                return this.$store.getters["settings/getSettings"];
            }
        }
    }

The data is then accessible via Vuex getters and automatically updated whenever
the backend broadcasts changes.

Backend Integration
~~~~~~~~~~~~~~~~~~~

On the backend side, the ``app.js`` socket controller keeps track of all
subscriptions in ``this.appDataSubscription``.  
When a user subscribes to a table, the backend:

1. Validates access rights for the user  
2. Applies filters (e.g., only user-owned or public rows)  
3. Sends the current snapshot of the table via ``sendTable``  
4. Registers the subscription so that future updates are pushed  

Whenever a change is made in the database inside a transaction,
the **afterCommit hook** collects all modified rows of ``autoTable`` models
and broadcasts them to relevant subscribers.

.. code-block:: javascript

    t.afterCommit(() => {
        if (t.changes) {
            const changesMap = t.changes.reduce((acc, entry) => {
                if (entry.constructor.autoTable) {
                    const tableName = entry.constructor.tableName;
                    const entryData = _.omit(entry.dataValues, defaultExcludes);
                    if (!acc.has(tableName)) acc.set(tableName, []);
                    acc.get(tableName).push(entryData);
                }
                return acc;
            }, new Map());

            for (const [table, changes] of changesMap) {
                this.broadcastTable(table, changes);
            }
        }
    });

Collaboration Use Case
~~~~~~~~~~~~~~~~~~~~~~

This subscription system enables **real-time collaboration**:

- If one user modifies a row (e.g., adds an annotation),  
  all other users subscribed to the ``annotation`` table immediately receive
  the updated data.  

- By maintaining a per-user subscription list, the backend can ensure
  that **only relevant users** are notified about changes.  

This approach avoids polling and ensures that all connected clients
remain synchronized with the authoritative state in the database.

.. _appdataupdate-socket:

AppDataUpdate Socket
--------------------

The ``appDataUpdate`` socket is the generic way to **create or update rows** in models with
``autoTable = true``. It is defined in ``backend/webserver/sockets/app.js`` inside the
``AppSocket`` class:

.. code-block:: javascript

    /**
     * Update data for a specific table to the client.
     *
     * Acts as a wrapper around the underlying `updateData` method, using a Sequelize
     * transaction if provided, and returns the outcome to the caller.
     *
     * @socketEvent appDataUpdate
     * @param {Object} data The input data from the frontend
     * @param {String} data.table The name of the table to update
     * @param {Object} data.data New data to update
     * @param {Object} options Additional configuration parameter
     * @param {Object} options.transaction Sequelize DB transaction options
     * @returns {Promise<*>} A promise that resolves with the result from updateData
     */
    async updateAppData(data, options) {
        return await this.updateData(data, options);
    }

This method wraps the internal ``updateData`` logic. It checks access permissions, validates
required fields, applies defaults, and then either **creates a new row** or **updates an
existing one**. All operations run inside a transaction, and on commit the modified rows are
broadcast to subscribed clients (see :ref:`data-transfer`).

How to use
~~~~~~~~~~

From the frontend you call:

.. code-block:: javascript

    this.$socket.emit("appDataUpdate", {
        table: "<table_name>",  // must be an autoTable model
        data: { /* fields */ }  // include id for updates, omit for create
    }, (result) => {
        if (result.success) {
            // result.data contains the new or updated id
        } else {
            // result.message contains a human-readable error
        }
    });

.. tip::
   - **Create**: omit ``id`` or set it to ``0``  
   - **Update**: include ``id``  
   - **Quick state toggles**: if you send an ``id`` with ``deleted``, ``closed``, ``public`` or ``end``,
     the server will update immediately without requiring other fields.

.. reminder::
   ``appDataUpdate`` only works for models with ``autoTable = true``.  
   For the definition of models, see :doc:`Database <database>`.

Example usage in the frontend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

A typical usage pattern is emitting the socket event and showing a toast depending on the result.

.. code-block:: javascript

    // Close a study (from Study.vue)
    this.$socket.emit("appDataUpdate", {
        table: "study",
        data: { id: studyId, closed: true }
    }, (result) => {
        if (result.success) {
            this.eventBus.emit('toast', {
                title: "Study closed",
                message: "The study has been closed",
                variant: "success"
            });
        } else {
            this.eventBus.emit('toast', {
                title: "Study closing failed",
                message: result.message,
                variant: "danger"
            });
        }
    });

.. tip::
   The server response has the shape:
   ``{ success: true, data: <id> }`` on success, or  
   ``{ success: false, message: "<error>" }`` on failure.

Important details
~~~~~~~~~~~~~~~~~

- **Validation**: on create, required fields are checked and defaults are applied.  
- **Access control**: if ``userId`` is provided, the server verifies the caller is allowed to update for that user.  
- **Nested tables**: if the model defines fields of type ``table``, the server recursively calls ``updateData`` to update child rows.  
- **Broadcasts**: after a successful commit, all subscribed clients receive the updated data automatically.

.. seealso::
   - :doc:`Database <database>` (model schema, required fields, defaults)
   - :ref:`Overview of Data Subscription <data-transfer>`
