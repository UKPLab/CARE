Table
=====

The basic table component allows you to render corporate design tables using a dictionary-based configuration.  
Two dictionaries are required: the ``columns`` description and the ``options`` for the table.  
After these are defined, any data can be passed and the table will render accordingly.  

**Columns**

The columns are described in the ``columns`` dictionary.  
The dictionary contains the following keys:

- ``name``: The name of the column, which will be displayed in the table header.  
- ``key``: The key of the data, which will be displayed in the table body.  
- ``type``: How the data is displayed. Available types: ``icon``, ``button``, ``button-group``, ``toggle``, ``badge``, ``datetime``, ``icon-selector``.  
  Defaults to text.  
- ``sortable``: If true, a sort icon will be shown and the column can be sorted.  
- ``sortKey``: Optional key for sorting. If not set, the ``key`` is used.  
- ``filter``: If defined, the column can be filtered using the provided array.  

**Types**

`Icon`: Displays a field value as an icon.  
The value must be a valid icon name.  

.. code-block:: html

    <TableIcon :value="row.typeIcon" :color="row.iconColor" />

Props:  

- ``value`` – Icon name (string, required)  
- ``color`` – Optional color string  

-----

`Button`: Displays a field value as a clickable button.  
Actions, icons, and titles can be defined and emitted on click.  

.. code-block:: html

    <TableButton
        title="Edit"
        icon="pencil"
        action="edit"
        :params="row"
        :options="{ specifiers: 'btn-outline-primary btn-sm' }"
        @action="onRowAction"
    />

Props:  

- ``title`` (required)  
- ``action`` (required)  
- ``icon`` (optional)  
- ``params`` (optional)  
- ``options`` – supports ``iconOnly`` and ``specifiers``  

Emits: ``@action`` → ``{ action, params, stats }``  

-----

`Button Group`: Displays multiple buttons as a group.  
Each entry follows the same schema as a button.  

.. code-block:: html

    <ButtonGroup
        :buttons="[
          { title: 'Edit',   action: 'edit',   icon: 'pencil' },
          { title: 'Delete', action: 'delete', icon: 'trash'  }
        ]"
        :params="row"
        @action="onRowAction"
    />

Props:  

- ``buttons`` (required)  
- ``params`` (optional)  

Emits: ``@action``  

-----

`Badge`: Renders a colored badge with optional tooltip.  
Class and label mappings can be provided via ``options``.  

.. code-block:: html

    <TableColumnBadge
        :value="row.status"
        :options="{
          classMapping: { active:'bg-success', pending:'bg-warning', default:'bg-secondary' },
          keyMapping:   { active:'Active',     pending:'Pending',     default:'Unknown' },
          tooltip: 'Current status'
        }"
    />

Props:  

- ``value`` – string or object (``{ text, class, tooltip }``)  
- ``options`` – mappings (``classMapping``, ``keyMapping``, ``tooltip``)  

-----

`Toggle`: Displays a boolean value as a switch input.  
Emits an action whenever the state changes.  

.. code-block:: html

    <TableToggle
        title="Active"
        action="toggle-active"
        :value="row.active"
        :params="row"
        @action="onRowAction"
    />

Props:  

- ``title`` (required)  
- ``action`` (required)  
- ``value`` (boolean, required)  
- ``params`` (optional)  

Emits: ``@action`` → ``{ action, params, value }``  

-----

`Datetime`: Displays the value as a datetime string.  
The value must be a valid datetime.  

-----

`Icon Selector`: Displays the value as an icon selector.  
The value must be a valid icon name.  
Also supports emitting actions.  

-----

`Options`: The options are described in the ``options`` dictionary.  
The dictionary contains the following keys:

- ``striped`` – striped rows  
- ``hover`` – hoverable rows  
- ``bordered`` – bordered table  
- ``borderless`` – borderless table  
- ``small`` – compact rows  
- ``pagination`` – enable pagination (``false`` or number)  

-----

**Pagination**

Pagination is handled by the ``BasicTablePagination`` component.  

.. code-block:: html

    <BasicTablePagination
        :pages="pages"
        :current-page="currentPage"
        :items-per-page="limit"
        :items-per-page-list="[10,25,50,100]"
        :show-pages="3"
        @updatePage="p => currentPage = p"
        @updateItemsPerPage="n => limit = n"
    />

Props:  

- ``pages`` (required)  
- ``currentPage`` (required)  
- ``itemsPerPage`` (default: 10)  
- ``itemsPerPageList`` (default: [10,25,50,100])  
- ``showPages`` (default: 3)  

Emits:  

- ``@updatePage(newPage)``  
- ``@updateItemsPerPage(n)``  
