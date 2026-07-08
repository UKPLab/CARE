Templates
=========

The **Templates** system provides email and document content templates that can be used for system emails, session and assignment notifications, study-closed emails, and pre-filled document content.  
Templates are edited in the same Quill-based Editor as documents; placeholder resolution is done by the backend when the template is used.

Key features include:

  - **Template types** with fixed placeholder sets and usage locations (see table below).
  - **Multi-language content** stored in ``template_content``; default language on the ``template`` row.
  - **TemplateEditor** and **TemplateConfigurator** (Placeholders sidebar) shown when the Editor is opened with a template (``templateId`` provided).
  - **Toolbar and editor behavior** controlled by the same settings as the document editor (see :ref:`Editor Settings <editor-settings-ref>`).

Overview
--------

Templates are listed and created from **Dashboard → Templates**. See the :doc:`dashboard <dashboard>` documentation for navigation details.

Location: ``frontend/src/components/dashboard/Templates.vue``

When you open a template for editing, the Editor loads with ``templateId`` provided; it renders the :doc:`editor` (TemplateEditor) for the main content and, for email types (1, 2, 3, 6) and prompt templates (type 8), a **Placeholders** sidebar so you can insert allowed placeholders (e.g. ``~username~``, ``~link~`` for emails, or ``~nlpAssessmentSuggestion~``, ``~assessmentResult~`` for prompts) into the text.

Location: ``frontend/src/components/editor/sidebar/TemplateConfigurator.vue``

Backend storage:

- **template** — name, type, public, defaultLanguage, userId.  
- **template_content** — content (Quill Delta) per template and language.  
- **template_edit** — draft edits per template and language.  
- **placeholder** — placeholder keys and labels per template type (used by the frontend sidebar; resolution rules live in the resolver).

Location: ``backend/utils/templateResolver.js``

Placeholder resolution is implemented there: ``resolveTemplate`` (returns HTML for emails) and ``resolveTemplateToDelta`` (returns Delta for document creation).  
Allowed placeholders per template type come from the ``placeholder`` database table; ``buildReplacementMap`` / ``buildPromptPlaceholderValues`` substitute only keys allowed for ``context.templateType``.

Placeholder token helpers
~~~~~~~~~~~~~~~~~~~~~~~~~

Bracket-indexed placeholder tokens (``~key[N]~``) are parsed, formatted, and replaced by a shared util module used by both the backend resolver and the frontend template editor.

Backend Integration
^^^^^^^^^^^^^^^^^^^

Location: ``utils/modules/placeholder-tokens``

.. code-block:: javascript

    const { applyPlaceholderReplacements, getUsedIndexes } = require('placeholder-tokens');

This logic is used in:

- ``backend/utils/templateResolver.js`` – placeholder resolution, duplicate checks, and used-index reporting
- ``backend/webserver/sockets/template.js`` – save validation via the resolver

Frontend Integration
^^^^^^^^^^^^^^^^^^^^

.. code-block:: javascript

    import { formatPlaceholderToken, countPlaceholdersByKey } from 'placeholder-tokens';

This logic is used in:

- ``frontend/src/components/editor/sidebar/TemplateConfigurator.vue`` – insert, count, and validate placeholders
- ``frontend/src/basic/modal/skills/InputMap.vue`` – hook input rows per index
- ``frontend/src/components/editor/template/placeholderExamplePreview.js`` – preview replacement

Testing
^^^^^^^

The tests are located in ``utils/modules/placeholder-tokens/tests/placeholder-tokens.test.js``. To execute the tests, use:

.. code-block:: bash

    make test-modules

Implementing the Template Editor
---------------------------------

The main Editor provides ``templateId`` via ``provide`` and conditionally shows the Placeholders sidebar when the document is a template with placeholders.  
TemplateEditor and TemplateConfigurator are used inside this Editor when editing a template. When the user saves and closes the editor, draft edits are merged from
``template_edit`` into ``template_content`` so that the next resolution uses the latest saved content.

Location:

- ``frontend/src/components/editor/Editor.vue``
- ``frontend/src/components/editor/template/TemplateEditor.vue``
- ``frontend/src/components/editor/sidebar/TemplateConfigurator.vue``

.. code-block:: html

    <TemplateEditor v-if="templateId" />
    <template v-if="templateId && template && !readOnlyOverwrite && hasPlaceholders" #templateConfigurator>
      <TemplateConfigurator />
    </template>


Template Types, Placeholders, and Usage
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

At resolution time, only the placeholder keys listed in the following table are substituted.

+--------------------------+--------+--------------------------------------+------------------------------------------------------------+
| Template type            | Value  | Placeholders                         | Where used                                                 |
+==========================+========+======================================+============================================================+
| Email - General          | 1      | ``username``, ``firstName``,        | Auth/system emails: settings                               |
|                          |        | ``lastName``, ``link``\*            | ``email.template.passwordReset``,                          |
|                          |        |                                      | ``email.template.verification``,                           |
|                          |        |                                      | ``email.template.registration`` in ``auth.js``.            |
+--------------------------+--------+--------------------------------------+------------------------------------------------------------+
| Email - Study Session    | 2      | ``username``, ``link``\*            | Session start/finish emails: settings                      |
|                          |        |                                      | ``email.template.sessionStart``,                           |
|                          |        |                                      | ``email.template.sessionFinish`` in ``study_session.js``.  |
+--------------------------+--------+--------------------------------------+------------------------------------------------------------+
| Email - Assignment       | 3      | ``username``, ``assignmentType``,   | Assignment emails: setting ``email.template.assignment``   |
|                          |        | ``assignmentName``, ``link``\*      | in ``assignment.js``.                                      |
+--------------------------+--------+--------------------------------------+------------------------------------------------------------+
| Document - General       | 4      | none                                 | Pre-fill document content when creating a document with    |
|                          |        |                                      | ``templateId`` in ``document.js``.                         |
+--------------------------+--------+--------------------------------------+------------------------------------------------------------+
| Document - Study         | 5      | none                                 | Document templates for study steps (create from template)  |
|                          |        |                                      | in ``study_step.js``.                                      |
+--------------------------+--------+--------------------------------------+------------------------------------------------------------+
| Email - Study Close      | 6      | ``username``, ``studyName``\*        | Study-closed emails: setting                               |
|                          |        |                                      | ``email.template.studyClosed`` (``sendStudyClosedEmails``) |
|                          |        |                                      | in ``study.js``.                                           |
+--------------------------+--------+--------------------------------------+------------------------------------------------------------+
| Prompt                   | 8      | ``pdfText``, ``editorText``,         | Study/NLP prompt templates: ``templateResolve`` in         |
|                          |        | ``assessmentResult``,                | ``backend/webserver/sockets/template.js`` (see below)      |
|                          |        | ``inlineComments``,                  |                                                            |
|                          |        | ``nlpAssessmentSuggestion``,       |                                                            |
|                          |        | ``previousAssessmentResult``,      |                                                            |
|                          |        | ``assessmentConfiguration``,         |                                                            |
|                          |        | ``submissionFiles``,               |                                                            |
|                          |        | ``studyContext``                     |                                                            |
+--------------------------+--------+--------------------------------------+------------------------------------------------------------+

Prompt templates (type 8)
~~~~~~~~~~~~~~~~~~~~~~~~~

.. _prompt-templates-ref:

Prompt templates use the same Placeholders sidebar and ``placeholder`` table as email templates.

Location: ``backend/webserver/sockets/template.js`` (``templateResolve``)

At edit time, TemplateEditor preview (types 1, 2, 3, 6, and 8) substitutes ``placeholderExample`` from the
``placeholder`` row when set (sample text only; rows may be empty until examples are added).
At runtime, ``buildPromptPlaceholderValues`` in ``backend/utils/templateResolver.js`` loads real values from
``context`` and the database. Many placeholders need ``documentId``, ``studySessionId``, and ``studyStepId``;
if they are missing, those tokens resolve to an empty string.

``~nlpAssessmentSuggestion~`` is the NLP draft assessment for the current step (same ``document_data`` as the
Assessment sidebar pre-fill), not the saved rubric in ``assessment_result`` (use ``~assessmentResult~`` for that).
Resolution is implemented in ``backend/utils/studyNlpDocumentData.js``.

``~editorText~`` is plain text from the HTML or modal document (``resolveEditorText`` in
``backend/utils/templateResolver.js``): base ``.delta`` plus session draft edits, including earlier steps in the same
session. Pass ``context.editorText`` on ``templateResolve`` to override (capped at 15k characters). Call
``templateResolve`` after step loading (``loadingReady``) or on user action—not in the same pass as NLP
``insertIntoEditor`` unless ``context.editorText`` is set explicitly.

Adding a New Template Type or Placeholder
-----------------------------------------

.. note::

   Placeholders marked with ``*`` in the table above are **required** for that type.
   If a required placeholder is missing from the template text, validation will fail
   (e.g. publishing or using the template) until it is added. The set of required
   placeholders is defined in the ``placeholder`` table (``required: true``) and
   enforced via ``getMissingRequiredPlaceholders`` in ``backend/utils/templateResolver.js``.

Email placeholders (types 1, 2, 3, 6) are resolved in ``buildReplacementMap`` from values on the resolver ``context``.
Prompt placeholders (type 8) are resolved in ``buildPromptPlaceholderValues`` (often from ``document_data`` or
``study_step``). For type 8, new keys must also be listed in the ``promptKeys`` array in ``buildReplacementMap`` so
that function is invoked.

Here is a concrete example for adding a new placeholder:

1. **Backend (DB + resolver):**

   - Add a row to the ``placeholder`` table via a migration (``type``, ``placeholderKey``, label, description,
     ``required``, and optionally ``placeholderExample`` for editor preview).

   - **Email (e.g. ``studyEndDate`` for type 6):** in ``buildReplacementMap``, when ``allow("studyEndDate")``::

         replacements["~studyEndDate~"] = context.studyEndDate || "";

     Ensure the call site (e.g. ``sendStudyClosedEmails`` in ``study.js``) passes ``studyEndDate`` on ``context``.

   - **Prompt (e.g. ``myNewField`` for type 8):** add ``"myNewField"`` to ``promptKeys`` in ``buildReplacementMap``,
     then in ``buildPromptPlaceholderValues``, when ``allow("myNewField")``::

         promptValues["~myNewField~"] = context.myNewField || "";

     For database-backed values, follow existing placeholders such as ``assessmentResult`` or
     ``nlpAssessmentSuggestion``. Ensure ``templateResolve`` passes the needed ``context`` fields (often
     ``documentId``, ``studySessionId``, ``studyStepId``).

2. **Frontend (editor + sidebar):**

   - The sidebar loads allowed placeholders from the database via ``templatePlaceholderGetAll``; no separate
     frontend list is required.

   - Optionally extend ``longDescriptions`` in
     ``frontend/src/components/editor/sidebar/TemplateConfigurator.vue`` for richer tooltip help (types 1, 2, 3, 6,
     and 8 already define entries; otherwise the sidebar uses ``placeholderDescription`` from the database).

3. **Access / type visibility:**

   - If the new placeholder is tied to a new template type, also update:

     - The template type dropdown in ``frontend/src/components/dashboard/templates/TemplateModal.vue``.
     - ``getUserFilter`` in ``backend/db/models/template.js`` so that only the correct
       users (e.g. admins) see or can use that type.

Settings
--------

The template editor uses the same toolbar and edit settings as the document editor.  
See :ref:`Editor Settings <editor-settings-ref>` in the :doc:`editor` documentation and :ref:`Adding a New Setting <add-setting-example-ref>` in :doc:`../../examples/settings` if you need to add or change a setting key.
