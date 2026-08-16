Data Table
==========

Let's imagine we want to create a new table in the database and show the content in the frontend.
The integration in CARE includes the following steps:

    1. Create a new migration to create the table in the database
    2. Create a new model to access the table
    3. Create a new navigation entry for the dashboard (as a migration in the database)
    4. Create a new view in the dashboard to show the content in the frontend

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
            static autoTable = true;
            static fields = [
                // describe a template for basic forms how to edit the data
            ];

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

3. Create Navigation Entry
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

4. Create Vue Component
-----------------------

The last step is to create a new vue dashboard component in the folder ``./frontend/src/components/dashboard`` with the same name we defined in the navigation entry ``ExampleTable.vue``.

For a card + table list page, use ``DashboardListPage``. Do not build a raw ``Card`` + ``BasicTable``
shell. Table options and height come from the list page. Full recipe (row buttons, filters, soft
delete): :doc:`../frontend/components/dashboard`. The shell itself is documented in
:doc:`../frontend/basic/dashboard`.

.. code-block:: html

    <template>
      <DashboardListPage
        title="Example Table Data"
        :columns="columns"
        :data="data"
        :buttons="buttons"
        @action="action"
      />
    </template>

.. code-block:: javascript

    <script>
    import DashboardListPage from "@/basic/dashboard/ListPage.vue";
    import { dashboardRowAction } from "@/basic/dashboard/actions.js";

    export default {
      name: "ExampleTable",
      subscribeTable: ["example_table"],
      components: { DashboardListPage },
      data() {
        return {
          columns: [
            { name: "User", key: "userId", sortable: true },
            { name: "Username", key: "creator_name", sortable: true },
            { name: "CreatedAt", key: "createdAt", sortable: true },
            { name: "Text", key: "exampleText" },
          ],
        };
      },
      computed: {
        data() {
          return this.$store.getters["table/example_table/getAll"];
        },
        buttons() {
          return [
            dashboardRowAction("edit", {
              title: "Edit",
              action: "edit",
            }),
          ];
        },
      },
      methods: {
        action(data) {
          if (data.action === "edit") {
            // open your edit modal with data.params
          }
        },
      },
    };
    </script>

Of course, you can add more columns and more complex components to the table.
See also ``Tags.vue`` and ``Projects.vue`` in the repository.
