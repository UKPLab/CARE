Quill Editor 
============

This section describes how to use the text editor within the CARE platform for writing, reviewing, or revising documents.

What the Editor Is For
~~~~~~~~~~~~~~~~~~~~~~

The CARE text editor is a built-in online writing environment designed to:

- Write or revise manuscripts, abstracts, or study documents
- Collaboratively edit text before annotation or feedback
- Finalize documents for peer review, feedback, or publication

Using the Editor in CARE
~~~~~~~~~~~~~~~~~~~~~~~~

To open the editor:

1. Navigate to a study or document in the ``Review Documents`` dashboard
2. Click ``Edit`` or ``Open Editor``

Edits are auto-saved as you type and changes are versioned in the backend.

Supported Features
~~~~~~~~~~~~~~~~~~

You can:

- Format text using the toolbar (e.g., bold, italic, lists, headings)
- Paste and refine content copied from other sources
- Work with a clean, distraction-free layout

Only text-based formatting is supported—no image uploads or embedded media.

Delta Versions and Revisions
~~~~~~~~~~~~~~~~~~~~~~~~~~~~


The editor records all changes using delta files. Each delta represents a set of edits applied to the document, and CARE saves this alongside a list of individual edit operations in the database.

- Delta files store the full document state
- The database stores each change with metadata (e.g., user, offset, operation)
- ``Draft`` edits can be reviewed separately from finalized ones

.. note::

   Researchers see only the current visible version in the interface. Full history is stored but not shown unless explicitly requested.
