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
2. Create a new frontend component in the ``frontend/src/components/dashboard`` directory

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

Finally, you add a new Vue component ``MyAnnotations.vue`` to the ``frontend/src/components/dashboard`` directory. For testing,
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

List dashboard pages
--------------------
A list-style management screen is a **card + table + row buttons**. Do not copy a raw ``Card`` / ``BasicTable``
shell. Use the shared list-page foundation under ``frontend/src/basic/dashboard/``
(component reference: :doc:`../basic/dashboard`):

* ``ListPage.vue`` (``DashboardListPage``) — card, header slot, table, default height
* ``constants.js`` — ``DEFAULT_DASHBOARD_TABLE_OPTIONS``, ``withSearch()``, ``DASHBOARD_TABLE_HEIGHT``
* ``actions.js`` — row-button catalog, ``DASHBOARD_BADGES``, ``confirmSoftDelete()``

Copy a small existing page such as ``Tags.vue`` or ``Projects.vue`` and change columns, data, and buttons.
Do not copy ``Log.vue`` (server-side pagination), ``Study.vue``, ``Submissions.vue``,
``SessionOverview.vue``, ``Settings.vue``, ``AdminTools.vue``, or ``UserStatistics.vue`` — those layouts are
specialized.

**Template**

.. code-block:: html

    <template>
      <DashboardListPage
        :title="$t('tags.title')"
        :columns="columns"
        :data="tagSets"
        :buttons="buttons"
        @action="action"
      >
        <template #headerActions>
          <BasicButton
            class="btn-primary btn-sm"
            :title="$t('tags.addNewTagSet')"
            icon="plus"
            @click="$refs.tagSetModal.open(0)"
          />
        </template>
      </DashboardListPage>
      <TagSetModal ref="tagSetModal" />
      <ConfirmModal ref="confirm" />
    </template>

``DashboardListPage`` already applies ``DEFAULT_DASHBOARD_TABLE_OPTIONS`` and
``DASHBOARD_TABLE_HEIGHT`` (see ``ListPage.vue``). Pass ``:table-options="withSearch()"``
only when the table needs search. Extra options passed to ``withSearch()`` are added on top
of the defaults, they do not replace them. Put page modals as siblings of ``DashboardListPage``,
as ``Tags.vue`` and ``Projects.vue`` do. Extra UI under the table goes in ``#afterTable``
(``Documents.vue``). Register ``BasicButton``, ``ConfirmModal``, and the page modal the same
way ``Tags.vue`` does.

Column names and row-button titles that use ``$t`` belong in ``computed``, not ``data``,
so they update when the locale changes. Header buttons pass ``:title="$t(...)"`` (see
:doc:`../../i18n`).

**Script imports**

.. code-block:: javascript

    import DashboardListPage from "@/basic/dashboard/ListPage.vue";
    import { dashboardRowAction, confirmSoftDelete } from "@/basic/dashboard/actions.js";

Also from those files when needed: ``withSearch`` from ``constants.js``;
``dashboardRowButton`` and ``DASHBOARD_BADGES`` from ``actions.js``.

Declare ``subscribeTable: ["<table>"]`` for every table whose getter this page reads
(see :doc:`../plugins`). Read rows with ``this.$store.getters["table/<table>/getAll"]``
or ``getFiltered`` (see :doc:`../vuex_store`).

**Row buttons**

* ``dashboardRowAction("edit", { title, action, filter, stats })`` — catalog name
  (``edit``, ``delete``, ``copy``, ``share``, ``download``, …) so icons and colors stay consistent.
  Unknown catalog names throw (see ``dashboardRowAction`` in ``actions.js``).
* ``dashboardRowButton("upload", { title, action, ... })`` — first argument is a Bootstrap icon
  name, not a catalog key. Use this for page-only icons (Assignments metadata upload uses
  ``"upload"``).
* Handle ``@action``. Existing pages name the handler ``action`` (Tags, Projects) or
  ``chooseAction`` (Users, Workflows). Switch on ``data.action``.

**When a button should appear only on some rows**

``filter`` is a list of ``{ key, value }`` checks against that row. One check is enough by itself.
With two or more checks, decide OR vs AND:

* Default is **OR** — show the button if **any** check matches. Use this when the same field has
  two allowed values (for example uploaded by me **or** uploaded by nobody).
* ``filterMode: "and"`` — show the button only if **all** checks match. Use this when two different
  fields must be true together.

Share on a private row you own needs **AND**. Without it, Share also appears on someone else's
private row (``public === false``) and on your already-public row (``userId`` matches):

.. code-block:: javascript

    dashboardRowAction("share", {
      title: this.$t('tags.shareTagSet'),
      action: "publishTagSet",
      filter: [
        { key: "public", value: false },
        { key: "userId", value: this.userId },
      ],
      filterMode: "and",
    })

**Soft delete**

If the row is removed with ``appDataUpdate`` and ``deleted: true``, call ``confirmSoftDelete`` from
``actions.js`` (confirm dialog + socket + error toast). Keep a dedicated socket such as
``templateDelete`` or ``submissionDelete`` when that is how the backend deletes the row.

.. code-block:: javascript

    confirmSoftDelete(
      {
        confirmRef: this.$refs.confirm,
        socket: this.$socket,
        eventBus: this.eventBus,
      },
      {
        table: "tag_set",
        id: row.id,
        title: this.$t('tags.messages.deleteTitle'),
        message: this.$t('tags.messages.deleteConfirm'),
        failTitle: this.$t('errors.tags.tagSetDeleteFailed'),
      }
    );

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
For a full dashboard list page, wrap it with ``DashboardListPage`` as described above.
``DashboardListPage`` uses the basic table component :doc:`Table <../basic/table>`.

