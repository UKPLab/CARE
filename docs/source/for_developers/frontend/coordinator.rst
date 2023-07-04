Coordinator
===========

The coordinator component is a wrapper around the form components. It offers a simple way to build a form to add/edit data in the backend.
The basic idea is that the coordinator manages the data from the vuex store and data transfer with the backend.
It uses the ``fields`` definition of a table (from backend) to build and validate the form.

.. code-block:: html

    <BasicCoordinator
      ref="coordinator"
      table="study"
      title="Study"
      @success="success">
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

//TODO: add props table
//TODO: add links to other documentation parts

Forms
-----
To build forms, you can use the form component. It offers a simple way to build forms in a consistent way only by passing a dictionary.

//TODO