Data Table
==========

Let's imagine we want to create a new table in the database and show the content in the frontend.
The integration in CARE includes the following steps:

    1. Create a new migration to create the table in the database
    2. Create a new model to access the table
    3. Create a new socket that manage the dataflow between the frontend and the backend
    4. Create a new vuex store to manage the data in the frontend
    5. Create a new navigation entry for the dashboard (as a migration in the database)
    6. Create a new view in the dashboard to show the content in the frontend

We provide here only some basic example code and refer to the individual sections in the documentation for more details.

1. Migration
------------

The migration should create the table in the database, see :doc:`../backend/database` for more details.

Let's assume we want to create a table with the name ``example_table`` and the column ``exampleText`` with a foreign key to the user table.
The migration should look like this:

.. code-block:: javascript

    module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('example_table', {
            id: {
                allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER
            },
            userId: {
                allowNull: false, type: Sequelize.INTEGER, references: { model: 'user', key: 'id' }
            },
            exampleText: {
                allowNull: false, type: Sequelize.STRING
            },
            deleted: {
                type: Sequelize.BOOLEAN, defaultValue: false
            },
            createdAt: {
                allowNull: false, type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false, type: Sequelize.DATE
            },
            deletedAt: {
                allowNull: true, defaultValue: null, type: Sequelize.DATE
            }
        });
    }, async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('example_table');
    }

To apply the migration, we have to run the command ``make init``.

2. Create Model
---------------

The model should be created in the folder ``./backend/db/models`` with the same name as the table like ``example_table.js``.
This model should also extend the class ``MetaModel`` from the file ``./backend/db/MetaModel.js``.

.. code-block:: javascript

    'use strict';
    const MetaModel = require("../MetaModel.js");

    module.exports = (sequelize, DataTypes) => {
        class ExampleTable extends MetaModel {
            static associate(models) {
            }
        }
        ExampleTable.init({
            userId: DataTypes.INTEGER,
            exampleText: DataTypes.STRING,
            deleted: DataTypes.BOOLEAN,
            deletedAt: DataTypes.DATE
        }, {
            sequelize,
            modelName: 'example_table',
            tableName: 'example_table'
        });
        return ExampleTable;
    };

3. Create Socket
----------------

Now we have to create a new socket in the folder ``./backend/webserver/sockets``, again with the name of the table like ``example_table.js``.
This socket should extend the class ``Socket`` from the file ``./backend/webserver/Socket.js``.
See :doc:`../backend/socket` for more details.

This example implements the socket to send all data to the frontend and to update the data in the database.

.. code-block:: javascript

    const Socket = require("../Socket.js");

    module.exports = class ExampleTableSocket extends Socket {

        async updateData(id, data) {

            const currentData = await this.models['example_table'].getById(studyId);
            if (this.checkUserAccess(currentData.userId)) {
                const newData = await this.models['example_table'].updateById(id, data);

                if (newData.deleted) {
                    // additional steps if the data is deleted
                }

                this.emit("exampleTableRefresh", newData)
                return newData;
            } else {
                this.sendToast("You are not allowed to update this data", "Error", "Danger");
            }
        }

        async addData(data) {
            data.userId = this.userId;

            const newData = await this.models['example_table'].add(data);
            this.emit("exampleTableRefresh", newData);

            return newData;
        }

        async sendData(userId = null) {
            try {
                if (this.isAdmin()) {
                    if (userId) {
                        this.emit("exampleTableRefresh", await this.models['example_table'].getAllByKey('userId', userId));
                    } else {
                        this.emit("exampleTableRefresh", await this.models['example_table'].getAll());
                    }
                } else {
                    this.emit("exampleTableRefresh", await this.models['example_table'].getAllByKey('userId', this.userId));
                }
            } catch (err) {
                this.logger.error(err);
            }
        }

        async init() {

            this.socket.on("exampleTableGetAll", async (data) => {
                try {
                    await this.sendData((data && data.userId) ? data.userId : null);
                } catch (err) {
                    this.logger.error(err);
                }
            });

            this.socket.on("exampleTableUpdate", async (data) => {
                try {
                    if (data.id && data.id !== 0) {
                        await this.updateData(data.id, data);
                    } else {
                        await this.addData(data);
                    }
                } catch (err) {
                    this.logger.error(err);
                    this.sendToast(err, "Error updating data", "Danger");
                }
            });
    }

.. note::

    Please think about updating the AsyncAPI documentation in the file ``./docs/api.yml`` with the new socket events.
    Furthermore, you should integrate a new socket test, see :doc:`../backend/testing` for more details.

4. Create Vuex Store
--------------------

The next step is to create a new vuex store in the folder ``./frontend/src/store/modules`` with the name of the table like ``example_table.js`` and adding the new store to the file ``./frontend/src/store/index.js``.
See :doc:`../frontend/vuex_store` for more details.

.. code-block:: javascript

    import refreshState from "../utils";

    export default {
        namespaced: true,
        strict: true,
        state: () => {
            return [];
        },
        getters: {
            getData: state => {
                return state;
            },
        },
        mutations: {
            SOCKET_exampleTableRefresh: (state, data) => {
                refreshState(state, data);
            },
        },
        actions: {}
    };

5. Create Navigation Entry
--------------------------

The next step is to create a new navigation entry. These are dynamically loaded from the database,
such that we have to add a new migration to add the new entry to the database, like in the first step.
The migration should look like this:

.. code-block:: javascript

    'use strict';

    const navElements = [
        {
            name: "Example Table Data",
            groupId: "Default",
            icon: 'table',
            order: 10,
            admin: false,
            path: "example_table",
            component: 'ExampleTable'
        }
    ];

    module.exports = {
        async up(queryInterface, Sequelize) {
            await queryInterface.bulkInsert("nav_element",
                await Promise.all(navElements.map(async t => {
                    const groupId = await queryInterface.rawSelect('nav_group', {
                        where:
                            {name: t.groupId}
                        ,
                    }, ['id']);

                    t['createdAt'] = new Date();
                    t['updatedAt'] = new Date();
                    t['groupId'] = groupId;

                    return t;
                }),
                {}));
        },

        async down(queryInterface, Sequelize) {
            //delete nav elements first
            await queryInterface.bulkDelete("nav_element", {
                name: navElements.map(t => t.name)
            }, {});
        }
    };

To apply the migration, we have to run the command ``make init``.

6. Create Vue Component
-----------------------

The last step is to create a new vue dashboard component in the folder ``./frontend/src/components/dashboard`` with the same name we defined in the navigation entry ``ExampleTable.vue``.
We make use of several basic components, see :doc:`../frontend/base_components` for more details.

.. code-block:: html

    <template>
      <Card title="ExampleTable">
        <template #body>
          <Table
            :columns="columns"
            :data="data"
            :options="options"
          />
        </template>
      </Card>
    </template>

.. code-block:: javascript

    <script>
    import Table from "@/basic/table/Table.vue";
    import Card from "@/basic/Card.vue";

    export default {
      name: "Log",
      components: {Card, Table},
      data() {
        return {
          options: {
            striped: true,
            hover: true,
            bordered: false,
            borderless: false,
            small: false,
            pagination: 30,
          },
          columns: [
            {name: "User", key: "userId", sortable: true},
            {name: "Username", key: "creator_name", sortable: true},
            {name: "CreatedAt", key: "createdAt", sortable: true},
            {name: "Text", key: "exampleText"},
          ],
        }
      },
      computed: {
        data() {
            return this.$store.getters["example_table/getData"];
        }
      }
    }

Of course, you can add more columns and more complex components to the table.
See also the already existing code in the repository.
