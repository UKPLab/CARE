Templates
=========

The **Templates** system provides email, document, and prompt content templates that can be used for system emails, session and assignment notifications, study-closed emails, submission-upload emails, pre-filled document content, and AI hooks.
Templates are edited in the same Quill-based Editor as documents. The backend fills placeholders when the template is used.

Key features include:

  - **Template types** with per-type placeholder sets and usage locations (see table below).
  - **Multi-language content** stored in ``template_content``; default language on the ``template`` row.
  - **TemplateEditor** and **TemplateConfigurator** (Placeholders sidebar) shown when the Editor is opened with a template (``templateId`` provided).
  - **Toolbar and editor behavior** controlled by the same settings as the document editor (see :ref:`Editor Settings <editor-settings-ref>`).

Overview
--------

Templates are listed and created from **Dashboard → Templates**. See the :doc:`dashboard <dashboard>` documentation for navigation details.

Location: ``frontend/src/components/dashboard/Templates.vue``

When you open a template for editing, the Editor loads with ``templateId`` provided. It renders the :doc:`editor` (TemplateEditor) for the main content. For email types (1, 2, 3, 6, 7) and prompt templates (type 8) it also shows a **Placeholders** sidebar so you can insert allowed placeholders (e.g. ``~username~``, ``~link~`` for emails, or ``~nlpAssessmentSuggestion~``, ``~assessmentResult~`` for prompts).

Location: ``frontend/src/components/editor/sidebar/TemplateConfigurator.vue``

Backend storage:

- **template** — name, type, public, defaultLanguage, userId.  
- **template_content** — content (Quill Delta) per template and language.  
- **template_edit** — draft edits per template and language.  
- **placeholder** — placeholder keys and labels per template type (used by the frontend sidebar; resolution rules live in the resolver).

Location: ``backend/utils/helper/templateResolver.js``

Placeholder resolution is implemented there: ``resolveTemplate`` (returns HTML for emails) and ``resolveTemplateToDelta`` (returns Delta for document creation).
Allowed placeholders per template type come from the ``placeholder`` database table; ``buildReplacementMap`` / ``buildPromptPlaceholderValues`` substitute only those keys for ``context.templateType``.

Dashboard import and export use ``templateExport`` and ``templateImport`` in
``backend/webserver/sockets/template.js``. The client store only has the
template row, so export loads each saved ``template_content`` row (language and
Quill delta) from the server and import writes those rows with the new template.
Export uses the same format choices as the other dashboard exports. Import
reads JSON and YAML. Export all
returns the caller's own rows, the same set as the dashboard table. Drafts in
``template_edit`` are not in the file. ``sourceId`` is not exported.
The imported row belongs to the user who imports it, and it is not public.
Publishing stays on the existing publish action.

Implementing the Template Editor
---------------------------------

The main Editor provides ``templateId`` via ``provide`` and conditionally shows the Placeholders sidebar when the document is a template with placeholders.  
TemplateEditor and TemplateConfigurator are used inside this Editor when editing a template. When the user leaves the editor (e.g. topbar back), draft edits are merged from
``template_edit`` into ``template_content`` so that the next resolution uses the latest saved content. See :ref:`Leaving the template editor <template-editor-leave-ref>` below.

Location:

- ``frontend/src/components/editor/Editor.vue``
- ``frontend/src/components/editor/template/TemplateEditor.vue``
- ``frontend/src/components/editor/sidebar/TemplateConfigurator.vue``

.. code-block:: html

    <TemplateEditor v-if="templateId" />
    <template v-if="templateId && template && !readOnlyOverwrite && hasPlaceholders" #templateConfigurator>
      <TemplateConfigurator />
    </template>

.. _template-editor-leave-ref:

Leaving the template editor (unsaved changes)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Templates use the same debounced autosave as documents (see :ref:`Debounce Behaviour <debounce-ref>`). While editing, ops are stored as drafts in ``template_edit``; stable content used by Settings and email resolution lives in ``template_content``.

**Save-on-leave:** In-app navigation (topbar back, dashboard links) runs ``beforeRouteLeave`` in ``frontend/src/components/Template.vue``. The guard calls ``flushPendingEdits`` on ``TemplateEditor`` (cancels debounce and sends buffered ops), then emits ``templateClose``, which calls ``saveTemplate`` in ``backend/webserver/sockets/template.js`` to merge drafts into ``template_content``.

**Required placeholders:** For email types (1, 2, 3, 6, 7), stable ``template_content`` in every language must include all required placeholders (``getMissingRequiredPlaceholders`` in ``backend/utils/helper/templateResolver.js``). Enforcement points:

- **Editor save:** ``saveTemplate`` rejects merges that omit required placeholders. The user may confirm discard; ``templateDiscardDrafts`` soft-deletes draft rows without updating ``template_content``.
- **Publish:** The ``template`` model ``beforeUpdate`` hook calls ``assertStableEmailTemplateContent`` when ``public`` becomes ``true``.
- **Settings:** ``validateEmailTemplateSettings`` in ``backend/webserver/utils/settingSave.js`` runs before persisting ``email.template.*`` keys (missing placeholders in any language row blocks assignment).

**Tab close / full reload:** ``beforeunload`` on ``TemplateEditor`` shows the browser's generic leave warning; the route guard does not run. Orphan drafts may remain until the next visit.

Template Types, Placeholders, and Usage
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

At resolution time, only the placeholder keys listed in the following table are substituted.

.. list-table::
   :header-rows: 1
   :widths: 20 8 30 42

   * - Template type
     - Value
     - Placeholders
     - Where used
   * - Email - General
     - 1
     - ``username``, ``firstName``, ``lastName``, ``link``\*
     - Auth/system emails: settings ``email.template.passwordReset``,
       ``email.template.verification``, ``email.template.registration``,
       ``email.template.twoFactorOtp``, ``email.template.passwordResetSuccess``.
   * - Email - Study Session
     - 2
     - ``username``, ``link``\*
     - Session start/finish emails: settings ``email.template.sessionStart``,
       ``email.template.sessionFinish`` in ``study_session.js``.
   * - Email - Assignment
     - 3
     - ``username``, ``assignmentType``, ``assignmentName``, ``link``\*
     - Assignment emails: setting ``email.template.assignment`` in ``assignment.js``.
   * - Document - General
     - 4
     - none
     - Pre-fill document content when creating a document with ``templateId`` in ``document.js``.
   * - Document - Study
     - 5
     - none
     - Study workflow editor steps: type 5 templates in
       ``frontend/src/basic/form/Select.vue`` (document dropdown when ``stepType`` is 2).
   * - Email - Study Close
     - 6
     - ``username``, ``studyName``\*
     - Study-closed emails: setting ``email.template.studyClosed``
       (``sendStudyClosedEmails``) in ``study.js``.
   * - Email - Submission upload
     - 7
     - ``username``, ``assignmentName``\*, ``eventType``, ``assignmentId``,
       ``submissionId``, ``timestamp``
     - Submission upload emails: settings ``email.template.submissionUpload``,
       ``email.template.submissionUploadConfirmation`` in ``document.js``.
   * - Prompt
     - 8
     - ``pdfText``, ``editorText``, ``assessmentResult``,
       ``inlineComments``, ``nlpAssessmentSuggestion``,
       ``previousAssessmentResult``, ``assessmentConfiguration``,
       ``submissionFiles``, ``studyContext``
     - Study/NLP prompt templates: ``templateResolve`` in
       ``backend/webserver/sockets/template.js`` (see below).

Prompt templates (type 8)
~~~~~~~~~~~~~~~~~~~~~~~~~

.. _prompt-templates-ref:

Prompt templates use the same Placeholders sidebar and ``placeholder`` table as email templates.

Location: ``backend/webserver/sockets/template.js`` (``templateResolve``)

At edit time, TemplateEditor preview (types 1, 2, 3, 6, 7, and 8) substitutes ``placeholderExample`` from the
``placeholder`` row (sample text only, not live data). Every current placeholder has an example.
At runtime, ``buildPromptPlaceholderValues`` in ``backend/utils/helper/templateResolver.js`` loads real values from
``context`` and the database. Many placeholders need ``documentId``, ``studySessionId``, and ``studyStepId``;
if they are missing, those tokens resolve to an empty string.

``~nlpAssessmentSuggestion~`` is the NLP draft assessment for the current step (same ``document_data`` as the
Assessment sidebar pre-fill), not the saved rubric in ``assessment_result`` (use ``~assessmentResult~`` for that).
Resolution is implemented in ``backend/utils/studyNlpDocumentData.js``.

``~editorText~`` is plain text from the HTML or modal document (``resolveEditorText`` in
``backend/utils/helper/templateResolver.js``): base ``.delta`` plus session draft edits, including earlier steps in the same
session. Pass ``context.editorText`` on ``templateResolve`` to override (capped at 15k characters). Call
``templateResolve`` after step loading (``loadingReady``) or on user action—not in the same pass as NLP
``insertIntoEditor`` unless ``context.editorText`` is set explicitly.

Adding a New Template Type or Placeholder
-----------------------------------------

.. note::

   Placeholders marked with ``*`` in the table above are **required** for that type.
   If a required placeholder is missing from stable content in any language, validation
   fails on editor save, publish, or Settings assignment until it is added. Required
   keys are rows in the ``placeholder`` table with ``required: true``.

Email placeholders (types 1, 2, 3, 6, 7) are resolved in ``buildReplacementMap`` from values on the resolver ``context``.
Prompt placeholders (type 8) are resolved in ``buildPromptPlaceholderValues`` (often from ``document_data`` or
``study_step``). For type 8, new keys must also be listed in the ``promptKeys`` array in ``buildReplacementMap`` so
that function is invoked.

Adding a placeholder
~~~~~~~~~~~~~~~~~~~~

For an existing type (example: ``studyEndDate`` on type 6):

- Add a ``placeholder`` row in a migration (``type``, ``placeholderKey``, label, required, and optionally ``placeholderExample`` for editor preview).
- **Email:** fill ``~studyEndDate~`` in ``buildReplacementMap`` in
  ``backend/utils/helper/templateResolver.js``. The call site (e.g.
  ``sendStudyClosedEmails`` in ``study.js``) must pass the value in the resolver context.
- **Prompt (e.g. ``myNewField`` for type 8):** add ``"myNewField"`` to ``promptKeys`` in ``buildReplacementMap``,
  then in ``buildPromptPlaceholderValues``, when ``allow("myNewField")``::

      promptValues["~myNewField~"] = context.myNewField || "";

  For database-backed values, follow existing placeholders such as ``assessmentResult`` or
  ``nlpAssessmentSuggestion``. Ensure ``templateResolve`` passes the needed ``context`` fields (often
  ``documentId``, ``studySessionId``, ``studyStepId``).
- Optional sidebar help: ``longDescriptions`` in
  ``frontend/src/components/editor/sidebar/TemplateConfigurator.vue``.

The Placeholders sidebar loads keys from the ``placeholder`` table.

Adding a template type
~~~~~~~~~~~~~~~~~~~~~~

- Add the option to ``fields`` on ``backend/db/models/template.js``.
- Put the type in ``emailTemplateTypes`` or ``otherTemplateTypes`` in
  ``backend/db/models/template.js`` and ``frontend/src/assets/templateTypes.js``.
  Prompt templates (type 8) belong in ``otherTemplateTypes`` so non-admins can create them.
- Add an empty ``placeholderConfigs`` entry in ``TemplateConfigurator.vue``
  so the sidebar can load keys for that type.
- Add the label in the ``typeName`` maps in ``Templates.vue``,
  ``PublicTemplatesModal.vue``, and ``TemplateConfigurator.vue``.

Settings
--------

The template editor uses the same toolbar and edit settings as the document editor.  
See :ref:`Editor Settings <editor-settings-ref>` in the :doc:`editor` documentation and :ref:`Adding a New Setting <add-setting-example-ref>` in :doc:`../../examples/settings` if you need to add or change a setting key.
