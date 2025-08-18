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
