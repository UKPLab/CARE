Table
=====

The basic table component give us the opportunity to describe a corporate design table just with a dictionary and there options.
There are two dictionaries to pass, the ``columns`` description and the ``options`` for the table.
After the table is described, we can pass any data to the table and it will be rendered.

.. code-block:: html

    <BasicTable
        :columns="columns"
        :data="data"
        :options="options"
        @action="action"
    />

.. code-block:: javascript

    import BasicTable from "@/basic/table/Table.vue";

    export default {
        components: {
            BasicTable
        },
        data() {
            return {
                options: {
                    striped: true,
                    hover: true,
                    bordered: false,
                    borderless: false,
                    small: false,
                    pagination: 10,
                },
                columns: [
                    {name: "Title", key: "name"},
                    {name: "Created At", key: "createdAt"},
                    {name: "Manage", key: "manage", type: "button-group"},
                ],
                data: [
                    {name: "Test", createdAt: "2019-01-01 00:00:00",
                    manage: [
                        {name: "Edit", icon: "edit", action: "edit"},
                        {name: "Delete", icon: "delete", action: "delete"},
                    ]},
                ],
            };
        },
        methods: {
            action(data) {
                console.log("Action: ", data.action);
                console.log("Params: ", data.params);
            },
        },
    };

Columns
-------

The columns are described in the ``columns`` dictionary. The dictionary contains the following keys:

- ``name``: The name of the column, which will be displayed in the table header.
- ``key``: The key of the data, which will be displayed in the table body.
- ``type``: The type how the data is displayed, available types: ``icon``, ``button``, ``button-group``, ``toogle``, ``badge``, ``datetime``,  ``icon-selector``. As default it will be displayed as text.
- ``sortable``: If the column is sortable, the column will be displayed with a sort icon and the data can be sorted by this column.
- ``sortKey``: The key of the data, which will be used for sorting. If the ``sortKey`` is not set, the ``key`` will be used.
- ``filter``: If the column is filterable, the column will be displayed with a filter icon and the data can be filtered by the passed array.

Types
^^^^^

Icon
~~~~

The ``icon`` type will display the data as an icon. The data must be a string and the string must be a valid icon name.

Button
~~~~~~

The ``button`` type will display the data as a button. On Buttons can be actions passed, which will be emitted on click.
You can also pass a icon and a title to the button.

Button Group
~~~~~~~~~~~~

The ``button-group`` type will display the data as a button group. On Buttons can be actions passed, which will be emitted on click.
Simple pass an array of buttons to the data.

Datetime
~~~~~~~~

The ``datetime`` type will display the data as a datetime. The data must be a string and the string must be a valid datetime.

Icon Selector
~~~~~~~~~~~~~

The ``icon-selector`` type will display the data as a icon selector. The data must be a string and the string must be a valid icon name.
On icon selectors can be actions passed, which will be emitted on click.

Options
-------

The options are described in the ``options`` dictionary. The dictionary contains the following keys:

- ``striped``: If the table is striped, the table will be displayed with striped rows.
- ``hover``: If the table is hoverable, the table will be displayed with hoverable rows.
- ``bordered``: If the table is bordered, the table will be displayed with borders.
- ``borderless``: If the table is borderless, the table will be displayed without borders.
- ``small``: If the table is small, the table will be displayed with small rows.
- ``pagination``: If the table is paginated, the table will be displayed with pagination. The pagination can be set to ``false`` to disable the pagination or to a number to set the pagination size.

Pagination
----------

It is also allowed to use a complex pagination.

Example:

.. code-block:: javascript

    pagination: {
      serverSide: true,
      itemsPerPage: 10,
      itemsPerPageList: [10, 25, 50, 100],
      total: 0,
      showPages: 3,
    },

- ``serverSide``: If the pagination is server side, the pagination will be displayed with a server side pagination.

For serverSide pagination, you have to update the data by your own with an emit event:

.. code-block:: html

    @pagination-update="paginationUpdate"

.. code-block:: javascript

    paginationUpdate(data) {
      console.log("Pagination update: ", data);
    },