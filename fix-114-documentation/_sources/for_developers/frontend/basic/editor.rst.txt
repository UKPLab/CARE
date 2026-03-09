Editor
------

The components in ``frontend/src/basic/editor`` provide utilities for rich-text editing (Quill), JSON viewing/editing, and service command testing. They encapsulate user interface and common behaviors (toolbars, history, toasts) for reuse in settings pages, modals, and dashboards.

**BasicEditor** – Quill-based rich-text editor for general content.  
Two-way binds a Quill Delta (string or object), supports read-only mode, and emits updates on change and blur.

.. code-block:: html

    <BasicEditor v-model="docDelta" :readOnly="false" />

.. code-block:: javascript

    import BasicEditor from "@/basic/editor/Editor.vue";
    export default { components: { BasicEditor }, data: () => ({ docDelta: { ops: [] } }) };

- Props: ``modelValue`` (Object|String, required), ``readOnly`` (Boolean, default: ``false``)  
- Emits: ``update:modelValue`` (Delta JSON string), ``blur``

-----

**EditorModal** – Convenience wrapper that opens **BasicEditor** inside a modal.  
Use this when an “Edit …” action should open a modal without additional wiring.

.. code-block:: html

    <EditorModal v-model="setting.value" :title="'Edit ' + setting.key" />

.. code-block:: javascript

    import EditorModal from "@/basic/editor/Modal.vue";
    export default { components: { EditorModal } };

- Props: ``title`` (String, required), ``modelValue`` (String|Object)  
- Methods (via ``ref``): ``open()`` – opens the modal

-----

**JsonEditor** – JSON tree viewer with optional inline editing.  
Supports copy-to-clipboard and a read-only mode for safe inspection.

.. code-block:: html

    <JsonEditor v-model:content="jsonData" />
    <JsonEditor :content="jsonData" readonly />

.. code-block:: javascript

    import JsonEditor from "@/basic/editor/JsonEditor.vue";
    export default { components: { JsonEditor }, data: () => ({ jsonData: { foo: "bar" } }) };

- Props: ``content`` (Object, required), ``readonly`` (Boolean, default: ``false``), ``startEditMode`` (Boolean)  
- Emits: ``update:content`` (on leaving edit mode)

-----

**CommandEditor** – Send service **requests** (REQ) or **commands** (CMD) to a backend service and inspect the message history.  
Allows selecting a service and command, editing a JSON payload, and viewing incoming/outgoing messages with timestamps.

.. code-block:: html

    <CommandEditor
      service="NLPService"
      :config="{ allowActionChange: true, allowServiceChange: true }"
      :init-payload="{ text: 'Hello' }" />

.. code-block:: javascript

    import CommandEditor from "@/basic/editor/CommandEditor.vue";
    export default { components: { CommandEditor } };

- Props: ``service`` (String, required), ``config`` (Object), ``initPayload`` (Object)  
- Methods: ``setPayload(obj)`` – replace the current payload  
- Notes: subscribes to the ``serviceRefresh`` socket event; warns if no response is received within 5 seconds

**MessageItem** – Read-only item for message logs (used by CommandEditor).  
Displays direction, time, service, type/command, and a togglable payload via **JsonEditor**.

-----

**Usage guidance**

- Use **BasicEditor** for document-like text (terms, descriptions, rich fields).  
  Use **EditorModal** when editing should occur in a modal.
- Use **JsonEditor** for configuration data or API payloads.
- Use **CommandEditor** to interactively send test requests/commands to services and review responses.

.. note::

   These components are lightweight building blocks; for the full-featured Quill editor with collaboration, database synchronization, study sessions, and advanced settings, see :doc:`Quill Editor <../components/editor>`.  
