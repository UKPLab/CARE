Form
----

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


**Basic form properties**

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

-----

**Extended form properties**

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
    * - readOnly
      - Marks the field as read-only (used instead of or with `disabled`)
      - false
      - false
      - Boolean
    * - suffix
      - Optional clickable icon/button inside input (e.g., for actions)
      - false
      - null
      - Object

.. list-table:: Available extended properties in form fields
    :header-rows: 1

    * - Type
      - label
      - disabled
      - help
      - placeholder
      - class
      - readOnly
      - suffix
    * - :ref:`text <form-type-text>`
      - Y
      - Y
      - Y
      - Y
      - Y
      - Y
      - Y
    * - :ref:`switch <form-type-switch>`
      - Y
      - Y
      - Y
      - N
      - Y
      - Y
      - N
    * - :ref:`slider <form-type-slider>`
      - Y
      - N
      - Y
      - N
      - Y
      - N 
      - N
    * - :ref:`datetime <form-type-datetime>`
      - Y
      - N
      - Y
      - N
      - N
      - N
      - N
    * - :ref:`select <form-type-select>`
      - Y
      - N
      - Y
      - N
      - N
      - Y 
      - N
    * - :ref:`checkbox <form-type-checkbox>`
      - Y
      - N
      - Y
      - N
      - Y
      - Y 
      - N
    * - :ref:`editor <form-type-editor>`
      - Y
      - N
      - Y
      - N
      - N
      - N 
      - N
    * - :ref:`textarea <form-type-textarea>`
      - Y
      - Y
      - Y
      - Y
      - Y
      - Y
      - N
    * - :ref:`table <form-type-table>`
      - Y
      - N
      - Y
      - N
      - N
      - N
      - N
    * - :ref:`password <form-type-password>`
      - Y
      - N
      - N
      - Y
      - Y
      - Y
      - N
    * - :ref:`file <form-type-file>`
      - Y
      - Y
      - Y
      - N
      - Y
      - Y
      - N
    * - :ref:`choice <form-type-choice>`
      - Y
      - N
      - Y
      - N
      - N
      - N 
      - N
    * - :ref:`default (*) <form-type-default>`
      - Y
      - Y
      - Y
      - Y
      - Y
      - Y
      - Y

-----

.. _Types:

**Specific form properties**

The following types are available:

.. _form-type-switch:

`Switch`: No specific options.

-----

.. _form-type-slider:

`Slider`: Additional options:

* min
* max
* step
* unit — Optional unit label shown next to the current value.
* textMapping — Array that maps numeric values to display labels.

  .. code-block:: javascript

      textMapping: [
          { from: 0, to: "Low" },
          { from: 1, to: "Medium" },
          { from: 2, to: "High" }
      ]

-----

.. _form-type-datetime:

`Datetime`: No specific options.

-----

.. _form-type-select:

`Select`: There are two ways to define the options of a select field, either by passing an object or use data from a autotable in (:doc:`../vuex_store`).

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
            table: <tableName>,             // the name of the autotable in the vuex store
            name: <keyOfDisplayName>,       // the key of the display text used in the table entries
            value:<keyOfValueUsed>,         // the key of the value used in the table entries
            filter: [                       // -- optional - list of filters to apply to the table entries
                {
                    type: <filterType>,    // the type of the filter
                    key: <keyOfFilter>,     // the key in the table entries that should be filtered
                    value: <valueOfFilter>  // the value that should be filtered for
                    mapping: <mapObject>    // the real values will be used as key of this object, the output values as compared value
                }
            ],
        },
    }


.. list-table:: Filter Table
    :header-rows: 1

    * - type
      - key
      - value
    * - (default)
      - the key in the table entries that should be filtered
      - the value that should be filtered for
    * - (formData)
      - the key in the table entries that should be filtered
      - the value of the formData with the key that should be filtered for
    * - (parentData)
      - the key in the table entries that should be filtered
      - the value of the parentData with the key that should be filtered for (used for choices)
    * valueAsObject — If `true`, the full object of the selected option will be emitted as `modelValue` instead of just the value field.

-----

.. _form-type-checkbox:

`Checkbox`: Each checkbox expects `options.options` to be an array of `{ label, value }` objects.

-----

.. _form-type-editor:

`Editor`: See :doc:`Editor <./editor>` for more information.

.. note::

    You can also use ``html`` as type.

-----

.. _form-type-textarea:

`Textarea`: No specific options.

-----

.. _form-type-table:

`Table`: Tables are a bit more complex, example:

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

-----

.. _form-type-password:

`Password`: No specific options.

-----

.. _form-type-file:

`File`: The ``file`` field type allows uploading a file using a standard file input.  
It is typically used for attaching documents such as PDFs or Delta files in forms.
The field stores the uploaded `File` object, which is then passed to the backend via socket communication.

Additional options:

* accept — allowed MIME types (e.g. `application/pdf`, `.delta`)
* class — custom input class

File uploads are handled via the ``documentAdd`` method in the ``document.js`` Socket.This is a **special case** because uploaded files are not just saved as form values but:

1. **Validated** — only ``.pdf`` and ``.delta`` files are allowed.
2. **Stored to disk** — files are written to the ``/files`` directory using a generated hash as filename.
3. **Stored in database** — an entry is created in the ``document`` table with metadata like ``name``, ``type``, ``userId``, etc.

**For .delta files:**

- A ``document_edit`` entry is also created using content from the Delta format. See :ref:`delta-overview-ref` for more information on how ``.delta`` files are stored and processed.

**For .pdf files:**

- Existing annotations are removed via a server RPC (``PDFRPC.deleteAllAnnotations``).
- If ``importAnnotations`` is set to ``true``, new annotations are automatically extracted and saved.

-----

.. _form-type-choice:

`Choice`: The ``Choice`` component displays a dynamic list of items (choices) where each row can be configured individually.
This component is useful when you want to collect structured data per entry—especially in workflows or assignments where each step or entity may have different options or linked configurations.

It renders a table layout and allows you to bind form fields per row.

While the ``options`` object often points to backend tables and filters (similar to how workflows are stored in the database),
it’s important to understand that **in the context of the Choice component, these keys control what is shown, editable, and validated in the UI**:

- ``table`` – Defines where the component stores and reads the selected/configured entries.
- ``choices.table`` – Defines the source from which the list of available rows is loaded.
- ``choices.filter`` – Controls which rows appear at all (static or dynamic rules).
- ``choices.disabled`` – Prevents specific rows from being selectable or editable while keeping them visible if needed.

.. tip::

    To better understand how the ``Choice`` component fits into a workflow, here’s a minimal example of how workflows are structured in the backend (see :doc:`../../../for_researchers/study/study_basics` for further examples of study workflows):

    .. code-block:: json

        [
          {
            "name": "Peer Review Workflow",
            "steps": [
              { "stepType": 1, "allowBackward": false },
              {
                "stepType": 2,
                "allowBackward": true,
                "configuration": {
                  "fields": [
                    { "name": "reviewLink" },
                    { "name": "reviewText" }
                  ]
                }
              }
            ]
          }
        ]

    In this structure:

    - Each workflow contains multiple ``steps``.
    - ``stepType`` defines the type of action (e.g., edit, review).
    - ``allowBackward`` determines if users can return to a step.
    - ``configuration`` holds extra options or fields for that step.

    **However**, when using the Choice component, you are not editing this structure directly.
    Instead, you are **selecting and configuring rows** from a source list (``choices.table``) based on filters (``choices.filter``),
    and binding the results to your form via ``v-model``.

Example usage:

.. code-block:: html

    <FormChoice
        v-model="workflowSteps"
        :options="{
            options: {
                table: 'workflow_step_assignment',
                choices: {
                    table: 'workflow_step',
                    filter: [
                        { type: 'formData', key: 'workflowId', value: 'workflowId' }
                    ]
                }
            }
        }"
        @update:config-status="handleStatus"
    />

.. code-block:: javascript

    import FormChoice from '@/basic/form/Choice.vue';

    export default {
        name: 'ChoiceExample',
        components: { FormChoice },
        data() {
            return {
                workflowSteps: [],
            };
        },
        methods: {
            handleStatus(status) {
                console.log("Config status:", status);
            },
        },
    };

.. list-table:: Choice properties
    :header-rows: 1

    * - Prop
      - Description
      - Type
      - Required
    * - modelValue
      - Two-way bound data array for all choices (stores the selected/configured rows).
      - Array
      - False
    * - options
      - Configuration object that defines both:
        - The target table for storing selection/configuration.
        - The source and filtering logic for available choices.
      - Object
      - True

.. list-table:: options.options.choices
    :header-rows: 1

    * - Key
      - Description
    * - table
      - Backend table from which the component **loads available choices** to display in the list.
    * - filter
      - Rules controlling **which rows are visible**.
        Can be based on static values or dynamic form data.
    * - disabled
      - Optional rules to **hide or lock** certain rows without removing them.

.. tip::

    The component emits ``@update:config-status`` whenever one or more of the rows has incomplete configuration.
    It also provides a ``validate()`` method which can be called from the parent via a ref to ensure all required inputs are set.

    While the backend table/field names come from the database model,
    **their effect inside the Choice component is purely about what gets rendered, how it can be interacted with, and what gets sent back when saving**.

-----

.. _form-type-default:

`Default`: Basic HTML `input <https://www.w3.org/TR/2010/WD-html5-20101019/the-input-element.html>`_ from type specified in ``type`` if no other type matches.
For example it is used for ``text``.

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

Additional options:

* suffix — Optional action button inside the input. Provide an object like:
  
  .. code-block:: javascript

      {
          suffix: {
              text: "Go",
              tooltip: "Click to trigger",
              onClick: () => { ... }
          }
      }

* readOnly — If `true`, the field cannot be modified but remains visible.
