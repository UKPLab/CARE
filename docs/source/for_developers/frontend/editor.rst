Editor
------
The editor component is a wrapper around the `TipTap editor <https://tiptap.dev/>`_. It offers a simple way to build a rich text editor.

You can simple use it inside a modal:

.. code-block:: html

    <EditorModal v-model="value" title="Edit"></EditorModal>

.. code-block:: javascript

    import EditorModal from "@/basic/editor/Modal.vue";

    export default {
        components: {
            EditorModal
        },
        data() {
            return {
                value: "<p>Some text</p>"
            }
        }
    }

.. tip::

    You can also use it inside a :doc:`form <./coordinator>`.