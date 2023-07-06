Coordinator
===========

The coordinator component is a wrapper around the form components. It offers a simple way to build a form to add/edit data in the backend.
The basic idea is that the coordinator manages the data from the vuex store and data transfer with the backend.
It uses the ``fields`` description of a :doc:`db tables <../backend/database>`  if provided to build and validate the form.

.. code-block:: html

    <BasicCoordinator
      ref="coordinator"
      table="study"
      title="Study"
      @success="success"
      @submit="submit">
        <template #title>
            <!-- fill this slot to overwrite basic title -->
        </template>
        <template #success>
            <!-- fill this slot to overwrite basic success message -->
        </template>
        <template #success-footer>
            <!-- fill this slot to overwrite basic success footer -->
        </template>
        <template #buttons>
            <!-- fill this slot to add buttons to the existing footer -->
        </template>
    </BasicCoordinator>

.. code-block:: javascript

    import BasicCoordinator from "@/basic/Coordinator.vue";

    export default {
        components: {
            BasicCoordinator
        },
        methods: {
            success(id) {
                console.log("Item saved with id: " + id);
            },
            submit(data) {
                console.log("Coordinator submitted the following data: ", data);
            }
        }
    }

.. list-table:: Coordinator properties
    :header-rows: 1

    * - Prop
      - Description
      - Default
      - Type
      - Required
    * - table
      - The table name of the data to be managed by the coordinator
      - None
      - String
      - true
    * - title
      - The title of the coordinator
      - None
      - String
      - true
    * - defaultValue
      - Default values to be overwritten in the form
      - {}
      - Object
      - false
    * - textAdd
      - The text of the add button
      - Add
      - String
      - false
    * - textUpdate
      - The text of the update button
      - Update
      - String
      - false
    * - textCancel
      - The text of the cancel button
      - Cancel
      - String
      - false


Forms
-----

To build forms, you can use the form component. It offers a simple way to build forms in a consistent way only by passing a dictionary.
Mainly it is used by the coordinator component, but it can also be used standalone.

.. code-block:: html

    <BasicForm
        ref="form"
        v-model="data"
        :fields="fields"
    />

.. code-block:: javascript

    import BasicForm from "@/basic/Form.vue";

    export default {
        components: {
            BasicForm
        },
        data() {
            return {
                data: {},
                fields: {},
            }
        },
    }

The formular is built from the properties of the object ``fields``.
It is a dictionary with basic keys to describe each part of the form.
There are three kinds of properties:

* Basic form properties - These properties are required for each field
* Extended form properties - These properties are optional and are specific to different field types
* Field specific properties - These properties are optional but are highly field specific


Basic form properties
~~~~~~~~~~~~~~~~~~~~~


.. list-table:: Basic form properties
    :header-rows: 1

    * - Key
      - Description
      - Required
      - Data Type
    * - key
      - The key of the field in the data object
      - true
      - String
    * - type
      - The type of the field (see :ref:`Types<Types>` for available types)
      - true
      - String
    * - required
      - If the field is required (will be validated in frontend and backend)
      - false
      - Boolean
    * - default
      - The default value of the field (data type depends on the field type)
      - false
      - Any
    * - pattern
      - The regex pattern of the field that is checked if required
      - false
      - String
    * - minLength
      - The minimum length of the field that is checked if required
      - false
      - Number
    * - maxLength
      - The maximum length of the field that is checked if required
      - false
      - Number


Extended form properties
~~~~~~~~~~~~~~~~~~~~~~~~

The properties of the ``fields`` object could be extended by the field specific properties. See the :ref:`Types<Types>` section for more information.

.. list-table:: Extended form properties
    :header-rows: 1

    * - Key
      - Description
      - Required
      - Default
      - Type
    * - label
      - The label of the field shown in frontend
      - true
      - ""
      - String
    * - disabled
      - If the switch should be disabled (also ``readOnly`` is possible)
      - false
      - false
      - Boolean
    * - help
      - The help text shown in the near of the field
      - false
      - ""
      - String
    * - placeholder
      - The placeholder text shown in the field
      - false
      - ""
      - String
    * - class
      - The class of the field
      - false
      - ""
      - String


.. list-table:: Available extended properties in form fields
    :header-rows: 1

    * - Type
      - label
      - disabled
      - help
      - placeholder
      - class
    * - :ref:`text<Text>`
      - Y
      - Y
      - Y
      - Y
      - Y
    * - :ref:`switch<Switch>`
      - Y
      - Y
      - Y
      - N
      - Y
    * - :ref:`slider<Slider>`
      - Y
      - N
      - Y
      - N
      - Y
    * - :ref:`datetime<Datetime>`
      - Y
      - N
      - Y
      - N
      - N
    * - :ref:`select<Select>`
      - Y
      - N
      - Y
      - N
      - N
    * - :ref:`checkbox<Checkbox>`
      - Y
      - N
      - Y
      - N
      - Y
    * - :ref:`editor<Editor>`
      - Y
      - N
      - Y
      - N
      - N
    * - :ref:`textarea<Textarea>`
      - Y
      - Y
      - Y
      - Y
      - Y
    * - :ref:`table<Table>`
      - Y
      - N
      - Y
      - N
      - N
    * - :ref:`*<Default>`
      - Y
      - Y
      - Y
      - Y
      - Y

Specific form properties
~~~~~~~~~~~~~~~~~~~~~~~~

The following types are available:

Switch
^^^^^^

No specific options.

Slider
^^^^^^

Additional options:

* min
* max
* step

Datetime
^^^^^^^^

No specific options.

Select
^^^^^^

There are two ways to define the options of a select field, either by passing an object or use data from a autotable in vuex store.

Passing an object:

.. code-block:: javascript

    {
        default: "info",
        options: [
            {
                name: "info",
                value: "info",
                class: "border border-info"
            },
            ...
        ]
    }

Using autotable:

.. code-block:: javascript

    {
        options: {
            table: <tableName>, id: <columnForForeignKey>
        },
    }

Checkbox
^^^^^^^^

No specific options.

Editor
^^^^^^

See :doc:`Editor <./editor>` for more information.

.. note::

    You can also use ``html`` as type.

Textarea
^^^^^^^^

No specific options.

Table
^^^^^

Tables are a bit more complex, example:

.. code-block:: javascript

    {
        key: "tags",
        label: "Tags:",
        type: "table",
        options: {
            table: "tag", id: "tagSetId"
        },
        required: true,
    }


It shows the corresponding fields of the table ``tag`` and allows to add and remove rows.
Only Select and Text fields are supported.


Default
^^^^^^^

Basic HTML `input <https://www.w3.org/TR/2010/WD-html5-20101019/the-input-element.html>`_ from type specified in ``type`` if no other type matches.
For example it is used for ``text`` or ``password``.

.. list-table:: Extended form properties
    :header-rows: 1

    * - Key
      - Description
      - Required
    * - name
      - The name of the input field
      - false
    * - class
      - The css class of the input field
      - false
    * - placeholder
      - The placeholder of the input field
      - false

