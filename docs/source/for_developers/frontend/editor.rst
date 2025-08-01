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

Refer to ``frontend/src/components/editor/Editor.vue`` for the full implementation.

.. _debounce-ref:

**Debouncing of text changes**

Debouncing is used to limit the number of database updates during text changes, improving performance and reducing the number of requests sent to the backend.
The editor captures text changes using Quill's ``text-change`` event.

.. tip::

    Set the debounce time based on the expected frequency of text changes and the desired performance with the setting `editor.edits.debounceTime`. 
    
    (see: **Dashboard → Settings → Editor → Edits**).

**Toolbar Configuration**

The toolbar can be customized based on the study or document context. Its visibility and available tools are managed through centralized settings in the admin dashboard:

- ``editor.toolbar.visibility`` – Toggles the entire toolbar
- ``editor.toolbar.showHTMLDownload`` – Adds an HTML download button
- ``editor.toolbar.tools.bold``, ``editor.toolbar.tools.header``, etc. – Enable/disable individual formatting options

For a full list of available settings, refer to the :ref:`Editor Settings <editor-settings-ref>`.

If you're developing the platform or need to introduce a new setting key, see :ref:`Adding a New Setting <add-setting-example-ref>` for instructions.

.. _delta-overview-ref:

Delta Files and DB Edits
~~~~~~~~~~~~~~~~~~~~~~~~

CARE’s document system supports **two distinct editing modes**, each optimized for a specific type of workflow:

- **Regular documents** are used for everyday writing and collaborative editing.
- **Study documents** are used in **controlled research workflows**, such as user studies, where each editing session is tracked per user and step.

These two document types follow **fundamentally different strategies** for how content is **loaded, edited, and saved**. Both modes use Quill as the editor and Vuex for local state, but the backend logic and sync model differ significantly.

CARE combines two types of persistent data storage:

- **Delta files** (``.delta``): contain the **most recently saved full document**. Used only by regular documents.
- **Database edits** (``document_edit`` table): contain **atomic operations** like inserts or deletions — along with metadata such as ``userId``, ``draft``, and optionally ``studySessionId`` and ``studyStepId``.

The diagram below shows the complete flow of how these layers interact, with **backend logic at the top**, **frontend (main user)** in the left, and **collaborative users** at the right:

.. image:: ./editor_flow_overview.png
    :width: 100%
    :align: center
    :alt: Flow of how the editor loads and synchronizes regular and study documents

.. raw:: html

    <br><br>

Regular Documents
~~~~~~~~~~~~~~~~~

Regular documents use a hybrid model that combines two sources when loading a document (as shown in the **top-left branches of the diagram**):

- A ``.delta`` file, which stores the last fully saved state. These entries are considered permanent and marked with ``draft = false``.
- A set of in-progress edits stored in the ``document_edit`` table. These represent unsaved changes and are marked with ``draft = true``.

When a regular document is opened, the backend performs two steps:

1. It reads the latest ``.delta`` file from disk.
2. It queries the ``document_edit`` table for all draft entries belonging to the document.

The draft entries are then passed through the ``dbToDelta()`` function (from ``editor-delta-conversion``) to convert them into Quill-compatible operations. Both sources, the saved delta and the current drafts, are **merged server-side** into a single Delta. This merged result is then sent to the frontend, where the **Quill editor** renders the complete up-to-date view.

During editing, every change made in the Quill editor is emitted as a Delta. Before sending these to the backend, the system converts them using ``deltaToDb()`` to generate a set of database-friendly atomic operations. These edits are transmitted via WebSocket (``editDocument`` event) and stored in the ``document_edit`` table with ``draft = true``. At the same time, the frontend Vuex store (``table/document_edit``) updates its local state to reflect these new changes.

.. tip::
   In the regular document flow, the editor always receives a **single merged Delta**, combining saved content and draft changes.
   This logic is visualized in the **upper left part of the diagram**.

To persist in-progress edits, the system uses **autosave** (see :ref:`Debounce Behaviour <debounce-ref>`). Autosave runs periodically and:

- Merges all ``draft: true`` edits with the current ``.delta`` file.
- Writes a new ``.delta`` to disk, reflecting the latest saved state.
- Updates the corresponding entries in the database, marking them as ``draft: false``.

This separation ensures durability while allowing users to work with unsaved content. The Quill editor always reflects the full working state, while the backend distinguishes between persisted and temporary data.

**Draft State: draft = true vs draft = false**

- Entries marked ``draft: true`` are temporary and unsaved. They exist only in the database and are editable or reversible.
- Entries marked ``draft: false`` have already been saved to the disk via the ``.delta`` file.
- On load, regular documents pull only ``draft: true`` edits from the database and combine them with the saved ``.delta`` state.

Study Documents
~~~~~~~~~~~~~~~

Unlike regular documents, **study documents do not use .delta files at all**. They are built for **session-based, isolated editing**, where all content is stored in the database and scoped by user session and step. This is shown in the **middle top branch** of the diagram.

All edits are stored in the ``document_edit`` table and grouped by:

- ``studySessionId``, identifying the unique editing session for a user.
- ``studyStepId``, representing a step in the study workflow (e.g., step 1, step 2).

When a study document is opened, the backend queries the ``document_edit`` table for all entries that match the current ``studySessionId`` and ``studyStepId``. These edits, whether draft or not, are passed through ``dbToDelta()``, ordered by creation time and sequence, and sent to the frontend. The Quill editor then renders this isolated document state for the user.

During editing, the system functions similarly to regular documents in terms of change tracking:

- The Quill editor emits change Deltas.
- These are converted via ``deltaToDb()`` and sent via WebSocket (``editDocument``).
- The backend stores each new operation in ``document_edit`` with the associated ``studySessionId``, ``studyStepId``, and ``draft: true``.

On the frontend, each edit is also added to the Vuex store (``table/document_edit``) and marked with ``applied = false`` by default. This is where the **applied logic** comes into play.

The frontend listens for incoming edits (e.g., from other collaborative users via WebSocket). When an edit arrives:

1. The Vuex store checks whether the edit has already been applied (based on its ID).
2. If not applied, the edit is converted using ``dbToDelta()`` and injected into the Quill editor.
3. The system then marks the edit as ``applied = true`` in the local Vuex state.
4. If the edit **was already applied**, it is skipped — ensuring no duplicate content.

This ensures that each edit is applied **exactly once**, even if received multiple times due to socket replays or network latency. As a result, multiple collaborators can work on the same study session without duplicating each other's input. Each participant only sees the edits associated with their session and step, keeping the workflow isolated and consistent.

.. tip::
   This edit coordination is visualized in the **bottom right part of the diagram**, where multiple clients apply edits without duplication.

The ``editDocument`` socket route is used identically in both modes. It:

- Accepts Deltas from the frontend (converted via ``deltaToDb()``).
- Stores each atomic operation in ``document_edit`` with ``draft: true``.
- Broadcasts the edit to other connected users viewing the same document (or in studies, the same session/step).

**Role of applied**

In study documents, ``applied`` is a **frontend-only flag** managed by Vuex. It determines whether a given edit has already been processed:

- Edits are only applied to Quill if ``applied = false``.
- After applying, the Vuex store updates the edit's ID to ``applied = true``.
- Edits received again, for example, through socket re-emission, are ignored.

In regular documents, this ``applied`` logic is less important, because the backend already merges the saved state and draft edits into a single Delta. The frontend receives this complete snapshot and doesn’t need to track individual edit application.

Editor-Deltas and Code Integration
----------------------------------

This section explains the **technical implementation** behind the concepts introduced above, especially how delta files and DB entries are transformed and synchronized between the frontend and backend.

For a conceptual overview, see :ref:`Delta Files and DB Edits <delta-overview-ref>`.

What Are Deltas?
~~~~~~~~~~~~~~~~

A Delta is a JSON-based data structure used by Quill to represent changes to a document. It is composed of operations like ``insert``, ``delete``, and ``retain`` to express differences between document states.

For full reference, see the official Quill Delta documentation: https://quilljs.com/docs/delta/

Backend Integration
~~~~~~~~~~~~~~~~~~~

Location: ``utils/modules/editor-delta-conversion``

.. code-block:: javascript

    const { dbToDelta, deltaToDb } = require('editor-delta-conversion');
    const delta = dbToDelta(databaseEdits);
    const dbEntries = deltaToDb(quillDelta, documentId, userId);

This transformation logic is used in:

- ``backend/webserver/sockets/document.js`` – Handles real-time WebSocket updates
- ``backend/db/models/document_edit.js`` – Converts and saves edits to the database

Frontend Integration
~~~~~~~~~~~~~~~~~~~~

In ``Editor.vue``, the Quill instance interacts with the backend through delta objects:

.. code-block:: javascript

    this.quill.setContents(dbToDelta(edits));  // Load document
    const dbEntries = deltaToDb(changeDelta);  // Save edits

The frontend uses the WebSocket to push these deltas, which are then stored as draft DB entries.

Sorting of DB Edits
~~~~~~~~~~~~~~~~~~~

To reconstruct the document consistently, DB edits are sorted first by timestamp, then by an optional ``order`` field:

.. code-block:: javascript

    entries.sort((a, b) => {
      const timeCompare = new Date(a.createdAt) - new Date(b.createdAt);
      if (timeCompare !== 0) return timeCompare;
      return (a.order || 0) - (b.order || 0);
    });

This is critical when applying a series of granular changes to restore a document’s state.

Testing the Editor
------------------

To ensure the editor's functionality, comprehensive tests are written for the delta conversion functions. 
These tests verify the correct conversion between Quill Delta objects and database entries.

Unit Tests
~~~~~~~~~~

The unit tests cover the following categories:
  - Insert Operations Test
  - Deletion Operations Test
  - Attribute Operations Test

**Running the Tests**

The tests are located in ``utils/modules/editor-delta-conversion/tests/editor-delta-conversion.test.js``. 
To execute the tests, use the following command:

.. code-block:: bash

    make test-modules

**Example Test Data**

Test data for the delta conversion tests are stored in JSON files located in `utils/modules/editor-delta-conversion/tests/data/`. 
Each file contains both delta and database entry representations of the document.
