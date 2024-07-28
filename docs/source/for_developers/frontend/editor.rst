Editor Documentation
====================

Overview
--------

This documentation is intended to help understand the codebase for the editor built using Quill. 
It outlines the connections and configurations necessary for extending the editor and provides instructions for logging user interactions, 
running unit tests, managing modules, and handling database migrations.

Connections and Workflow
------------------------

### Connections Between Components

1. **Editor Component (frontend/src/components/editor/Editor.vue)**:
Manages document editing using the Quill editor (https://quilljs.com/) and delta format to describe Quills content changes (https://quilljs.com/docs/delta/). 
Captures and debounces text changes, converting them into delta objects using methods in (utils/modules/editor-delta-conversion/index.js).
Communicates with the backend via WebSocket (backend/webserver/sockets/document.js) for real-time document updates and interactions.
2. **Editor Store (frontend/src/components/editor/editorStore.js)**:
Handles initialization and management of the Quill editor instance, ensuring it operates outside of the reactive Vue ecosystem.
3. **Delta Conversion Module (utils/modules/editor-delta-conversion/index.js)**:
Converts database entries into Quill Delta objects and vice versa, bridging frontend edits with backend storage.
4. **WebSocket Handlers (backend/webserver/sockets/document.js)**:
Facilitates all document-related communications such as creation, updates, and real-time edits.
Manages file uploads and document retrievals, ensuring proper data synchronization and access control.

### Running the Application

1. **Set Up the Environment**: Follow the installation steps to set up the environment.
2. **Initialize the Database and Modules**: Ensure the database is initialized and utils/modules is up to date using the Makefile command: make init.
3. **Start the Backend Server**: Ensure the backend server is running.
4. **Start the Frontend Server**: Ensure the frontend development server is running.
5. **Interact with the Editor**: Use the application to create, edit, and manage documents. Monitor WebSocket events to ensure real-time updates and synchronization.

Makefile Configuration
----------------------

New Make Commands:

- **make init**

  Initialize the database and install npm packages in all utils/modules subdirectories. This command calls both make tables and make modules

- **make tables**

Initialize (migrate) the database.

- **make test-modules**

  Run unit tests for specific modules - In our case to run the tests defined in `utils/modules/editor-delta-conversion`

- **make modules**

  Install npm packages in all `utils/modules` subdirectories

Database Migrations
-------------------

- **backend/db/migrations/20231125042054-extend-documents.js**

  This migration adds a `type` column to the `document` table to distinguish between different document types (e.g., PDF, HTML).

- **backend/db/migrations/20240411140804-create-document_edit.js**

  This migration creates the `document_edit` table to store edits made to documents. It includes fields for tracking the user, document, edit type, and other relevant metadata.

- **backend/db/migrations/20240411143901-extend-setting-editor.js**

  This migration extends the `setting` table to include various configuration options for the editor, such as debounce time for processing edits and toolbar and its tool-buttons visibility.

Database Models
---------------

- **backend/db/models/document.js**

  The `document` model has been extended to include the `createdAt` and `type` fields, ensuring these attributes are available for documents.

- **backend/db/models/document_edit.js**

  The `DocumentEdit` model is defined to store edits made to documents. This model includes fields for tracking user edits, the type of operation, 
  the span of text affected, and any additional attributes.


WebSocket Handlers
------------------

- **backend/webserver/sockets/document.js**

  The `document.js` file in the backend's `webserver/sockets` directory handles various document-related WebSocket events. 
  This includes creating documents, sending documents to clients, and managing edits.

- **backend/webserver/sockets/upload.js**

  The `upload.js` file in the backend's `webserver/sockets` directory handles file uploads, including both PDF and delta files. 
  It ensures that uploaded files are stored correctly and that the corresponding database entries are created.

Frontend Components
-------------------

- **frontend/src/components/Document.vue**

  The `Document.vue` component handles the display of documents based on their type. If the document is of type HTML, it loads the `Editor` component. 
  Otherwise, it loads the `Annotater` component.

- **frontend/src/components/dashboard/Documents.vue**

  The `Documents.vue` component in the dashboard displays a list of documents and provides options to create, upload, and manage documents. 
  It includes modals for different actions.

- **frontend/src/components/dashboard/documents/CreateModal.vue**

  The `CreateModal.vue` component provides the interface for creating a new document. It includes input fields and methods for handling the creation process.

- **frontend/src/components/dashboard/documents/UploadModal.vue**

  The `UploadModal.vue` component handles the uploading of documents, distinguishing between PDF and delta files.

Editor Component
----------------

- **frontend/src/components/editor/Editor.vue**

  The `Editor.vue` component is a central part of the application, providing a Quill editor for editing documents. 
  It initializes the editor, handles text changes, and processes deltas to update the database. Key features include:
  - Loading and displaying the editor.
  - Handling text changes and debouncing these changes.
  - Managing the content and state of the editor.
  - Providing a download button for exporting the document as HTML.

- **frontend/src/components/editor/editorStore.js**

  The `editorStore.js` file contains the `Editor` class, which wraps the Quill editor. 
  It ensures the editor is not reactive and manages its state.

- **frontend/src/components/editor/EditorDownload.vue**

  The EditorDownload.vue component provides a hidden Quill editor instance used for exporting documents in delta or HTML format. Key features include:

  - Initializing a hidden editor instance.
  - Fetching document data and setting the editor's contents.
  - Providing methods to export the document as a JSON delta file or an HTML file (used in frontend/src/components/dashboard/Documents.vue).


Delta Conversion Module
-----------------------

- **utils/modules/editor-delta-conversion/index.js**

  This module contains methods for converting between Quill Delta objects and database entries. It includes:
  - `dbToDelta`: Converts an array of database entries to a Quill Delta object.
  - `deltaToDb`: Converts a Quill Delta object to an array of database entries.

- **utils/modules/editor-delta-conversion/package.json**

  The `package.json` file for the `editor-delta-conversion` module defines its dependencies, scripts, and other metadata. 
  It includes commands for running tests, managing the database, and starting the module.

- **utils/modules/editor-delta-conversion/tests/editor-delta-conversion.test.js**

  This test file uses Jest to verify the correctness of the `dbToDelta` and `deltaToDb` functions. 
  It loads test data from JSON files and runs comprehensive tests to ensure the conversion functions work as expected.
  To run the test use the Makfile command: make test-modules.

- **Test Data for Delta Conversion:**
  - `utils/modules/editor-delta-conversion/tests/testData/data_attributes.json`
  - `utils/modules/editor-delta-conversion/tests/testData/data_delete.json`
  - `utils/modules/editor-delta-conversion/tests/testData/data_insert.json`

Toolbar Configuration
---------------------

- **backend/db/migrations/20240411143901-extend-setting-editor.js**
  
  This migration(as already mentioned above) contains the keys for the editor toolbar which includes the visibility of the toolbar and its tool-buttons.

- **frontend/src/components/dashboard/Settings.vue** 

  The `Settings.vue` component provides an interface for configuring the editor toolbar as per the admin's requirements. 
  It includes options to toggle the visibility of the toolbar and its individual tool-buttons as well. 
  The corresponding implementation for the tools can be found in the `frontend/src/components/editor/Editor.vue` component.

  **NOTE:** When the toolbar is hidden, the editor is still functional, but the toolbar is not visible, and regardless of which tool is activated, none of the tools are visible to the user.

-----------------

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