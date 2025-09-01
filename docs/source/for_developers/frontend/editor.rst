Quill Editor 
============

The Editor component is a delta-based Quill Editor used for editing documents. 
When the Editor is initialized, it is capable of handling text changes and processing deltas to update the database. 

Key features include:  
  - Handling text changes and debouncing these changes
  - Managing the content, formatting, and styling of the document
  - Configuring and customizing the toolbar
  - Exporting the document as HTML and full access to delta files

Overview
--------

This documentation is intended to help understand the codebase for the editor built using Quill. 
It outlines the connections and configurations necessary for extending the editor and provides instructions for logging user interactions, running unit tests, managing modules, and handling database migrations.

Implementing the Editor
-----------------------

To implement and use the editor, orient yourself on the existing implementation in the codebase. 
The following sections describe the key aspects and present basic code examples.

**Initialization and Configuration**

The editor should be properly initialized and configured. This involves setting up the editor container, initializing the editor instance, and configuring toolbar options and themes.

.. code-block:: javascript

    import Editor from '@/components/editor/Editor.vue';
    import { EditorStore } from './editorStore.js';

    export default {
      data() {
        return {
          editor: null,
        };
      },
      mounted() {
        const editorContainer = document.getElementById('<editor-container-id>');
        if (editorContainer) {
          this.editor = new Editor(editorContainer, {
            modules: {
              toolbar: true
            },
            theme: "snow"
          });
        }
      }
    };

Refer to `frontend/src/components/editor/Editor.vue` for the full implementation.

**Debouncing of text changes**

Debouncing is used to limit the number of database updates during text changes, improving performance and reducing the number of requests sent to the backend.
The editor captures text changes using Quill's `text-change` event.

.. tip::

    Set the debounce time based on the expected frequency of text changes and the desired performance with the setting `editor.edits.debounceTime`.


**Toolbar Configuration**

The toolbar can be customized based on the context. 
Toolbar visibility and tools can be managed through the settings module in Dashboard.

Database Columns
----------------

Understanding the roles of specific columns in the database tables is crucial for effective data management and extending the editor's functionality.
This is especially important when working with the database, as we use an internal representation of the document deltas.

**Document Table**

- `createdAt`: Timestamp of when the document was created.
- `type`: Specifies the document type (e.g., PDF, HTML).

**Document Edit Table**

- `userId`: Identifies the user who made the edit.
- `documentId`: References the document being edited.
- `draft`: Indicates if the edit is a draft.
- `offset`: Position of the edit in the document.
- `operationType`: Type of edit (0: Insert, 1: Delete, 2: Attribute-Change).
- `span`: Length of the text affected by the edit.
- `text`: Text involved in the edit.
- `attributes`: Additional attributes related to the edit.

.. note::

    Refer to `backend/db/models/document_edit.js` and `backend/db/migrations/20240411140804-create-document_edit.js` for detailed schema definitions.

.. _delta-files:

Delta Files on the Hard Disk 
----------------------------

Delta files are a fundamental part of the Quill editor, representing document changes in a compact JSON format. 
They enable efficient storage and optimized data transfer.

**What are Deltas and how to analyse them?**

A delta is a format for representing changes to a document. 
It is essentially an array of operations (insert, delete, and retain) that describe how to transform a document's contents from one state to another. 
For more details, see the Quill Delta documentation: https://quilljs.com/docs/delta/

**Purpose of Delta Files on Disk**

1. **Efficient Storage**:

   - Delta files store the current document state in a merged delta format.
   This minimizes storage requirements and ensures that only the necessary data is saved.

2. **Optimized Data Transfer**:

   - By storing the current state as a merged delta file, only the required changes need to be sent to the frontend.
   This reduces the amount of data transferred over the network and ensures quick updates.

**How Deltas are Used in the Editor and Document Socket**

1. **In the Editor**:

   - The editor component captures text changes and converts them into delta objects.
   - These delta objects represent the current state of the document and are used to update the frontend without needing to resend the entire document content.

   **Code Reference**: `frontend/src/components/editor/Editor.vue`

2. **In the Document Socket**:

   - When a document is edited, the editor sends the changes as deltas to the backend via WebSocket.
   - The backend processes these deltas, merges them with the existing document content, and saves the updated state as a delta file on disk. 
   This ensures that the most recent state of the document is efficiently stored and can be quickly retrieved.

   **Code Reference**: `backend/webserver/sockets/document.js`

Testing the Editor
------------------

To ensure the editor's functionality, comprehensive tests are written for the delta conversion functions. 
These tests verify the correct conversion between Quill Delta objects and database entries.

Unit Tests
----------

The unit tests cover the following categories:
  - Insert Operations Test
  - Deletion Operations Test
  - Attribute Operations Test

**Running the Tests**

The tests are located in `utils/modules/editor-delta-conversion/tests/editor-delta-conversion.test.js`. 
To execute the tests, use the following command:

.. code-block:: bash

    make test-modules

**Example Test Data**

Test data for the delta conversion tests are stored in JSON files located in `utils/modules/editor-delta-conversion/tests/data/`. 
Each file contains both delta and database entry representations of the document.
