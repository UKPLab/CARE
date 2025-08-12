Quill Editor
============

This section explains how to use the text editor within the CARE platform for writing, reviewing, or revising documents. It also describes how the editor works behind the scenes, how versions are handled, and how settings can be customized.

Overview
~~~~~~~~

The CARE text editor is built using `Quill <https://quilljs.com>`_, a modern open-source rich-text editor. It supports writing and formatting plain text documents directly in your browser.

All content is saved using the **Quill Delta format** – a structured JSON format that captures both the text and its formatting. This allows the system to:

- Efficiently store document history
- Reconstruct any version of the document
- Track edits made by users during studies

Accessing the Editor
~~~~~~~~~~~~~~~~~~~~

To begin editing a document:

1. Open the **Documents** section in the dashboard
2. Click on the ``Create`` button to start a new document
3. There you can choose between an ``General Document`` or a ``Study Modal Document``
   
   - In a **General Document**, you can write freely without any study context.
   - In a **Study Modal Document**, you can write within the context of a specific study, which means that this document is then meant to be used as one step within a study. More information about studies can be found in the :doc:`Studies documentation <study/study>`.

4. Enter the name of the document and click on **Create**
5. Now your document is available in the dashboard **Documents** section, and you can click on ``Access document`` to open the editor.

Edits are saved automatically in the background. There's no need to manually click a save button.

.. _editor-settings-ref:

Editor Settings
~~~~~~~~~~~~~~~

The CARE editor can be customized through a range of settings available to administrators. These control autosave behavior, toolbar visibility, and document-related actions. All editor-related settings can be accessed from:

**Dashboard → Settings → Editor**

Autosaving and Versioning
-------------------------

The editor uses a built-in **save buffer** (debounce mechanism). After you stop typing, the system waits briefly before saving your input, reducing unnecessary processing.

You can control this behavior via:

- ``editor.edits.debounceTime`` – Delay (in milliseconds) before edits are saved
- ``editor.edits.historyGroupTime`` – Group edits if they occur within a short time window
- ``editor.edits.showHistoryForUser`` – Allow all users (not just admins) to access the document edit history

Toolbar and Formatting Options
------------------------------

The editor includes a formatting toolbar that supports:

- Basic formatting (bold, italic, underline)
- Structural elements (headings, lists, block quotes)
- Utility tools (clean formatting, code blocks)

To configure toolbar visibility and tools:

- ``editor.toolbar.visibility`` – Toggles the entire toolbar
- ``editor.toolbar.showHTMLDownload`` – Toggles download button of HTML documents in the editor
- ``editor.toolbar.tools.*`` – Enable or disable individual tools such as bold, italic, lists, etc.

Document Controls
-----------------

Dashboard-level settings determine what users can do with documents. These include:

- ``editor.document.showButtonCreate`` – Toggles “Create Document” button in the dashboard
- ``editor.document.showButtonHTMLDownload`` – Toggles download button of HTML documents in the dashboard
- ``editor.document.showButtonDeltaDownload`` – Toggles download button of raw delta changes

.. tip::

   For more technical details on configuring these settings, see the
   :doc:`Frontend Settings documentation <../for_developers/frontend/settings>`.

Viewing Edit History
~~~~~~~~~~~~~~~~~~~~

For documents used in studies, you may see a **Show History** button in the editor’s top bar. This feature lets you:

- Compare current edits to the original version
- Understand how a document evolved during a study
- Restore earlier versions (depending on permissions)

.. note::

   By default, edit history is only visible to administrators. To allow all users to view history, enable ``editor.edits.showHistoryForUser`` in the settings.
