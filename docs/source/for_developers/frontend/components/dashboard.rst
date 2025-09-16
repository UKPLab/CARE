Dashboard
=======================

Dashboard Structure
-------------------
The dashboard is the centerpiece of the CARE frontend. Adding new management features generally means adding a new
dashboard component. A dashboard component consists of three ingredients:
*   a *configuration in the database*
*   the actual *vue component*
*   a *sub-route* in the vue app.

The configuration in the database defines who may see the component and how it should be listed in the dashboard. The
actual vue component describes, as usually, the UI and functionality in the frontend. The sub-route, which is also part
of the configuration, assigns a unique path to the component allowing to exploit vue routing features.

The dashboard vue components are all specified as components in the folder ``frontend/src/components/dashboard``.
The dashboard loads its components dynamically depending on the settings and user rights.
Likewise, the dashboard sidebar is populated based on the sidebar settings loaded from the database.
Each component that is visible to the specific user and configured in the settings is added here with an icon and the respective name.


Adding a New Dashboard Component
--------------------------------
Let's assume we want to add a new Dashboard component ``MyAnnotations``. To add the component, we need to

1. Add a new :doc:`DB migration <for_developers/backend/database>` extending the navigation database.
2. Create a new frontend component in the ``frontend/src/components`` directory

Please refer to the :doc:`database <for_developers/backend/database>` chapter for a detailed explanation of the
migration functionality. Here, we only cover the necessary commands and code snippets to add a dashboard component.

To create a new navigation element configuration to the database, you have to first create a migration file:

.. code-block:: bash

    npx sequelize migration:generate --name my_annotations-nav

Afterwards, you populate the migration file adding a new nav element to the nav table on ``up`` and deleting this
specific element again on ``down``:

.. code-block:: javascript

    const navElements = [
        {
            name: "My Annotations",
            groupId: "Default",
            icon: 'bookmark',
            order: 10,
            admin: false,
            path: "my_annotations",
            component: 'MyAnnotations'
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

Finally, you add a new Vue component ``MyAnnotations.vue`` to the ``frontend/src/components`` directory. For testing,
we set this to an empty component showing just "Hello World!":

.. code-block:: vue-js

    <template>
     <span>Hello World!</span>
    </template>
    <script>
    //... BOILERPLATE
    </script>

That's it -- to load the new component in the frontend, you first need to stop the service, run ``make init`` and
start it up again. Now you should see a nav element in the dashboard sidebar, which shows upon selection an empty
component with just the words "Hello World!".

Populating a Dashboard Component
------------------------------------
Populating a dashboard component usually means (A) loading data via the websocket interface and (B) visualizing it
within the frontend. Here, we will not cover the details of the websocket interface and the off-the-shelf components
available for visualization in the frontend, but provide only a conceptual overview of these two steps.

.. note::

    Please read the chapter on :doc:`conventions <for_developers/basics/conventions>` and
    the `socket API documentation </api>`_ for details on the existing websocket interface. If you need to extend the
    socket interface, please refer to the step-by-step guide in the :doc:`socket chapter <for_developers/backend/socket>`.


Table
-----
The table is the best way to visualize many rows of data.
We recommend to use the basic table component :doc:`Table <basic/table>` for this purpose.