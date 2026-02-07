Templates
=========

The **Templates** system provides email and document content templates that can be used for system emails, session and assignment notifications, study-closed emails, and pre-filled document content.  
Templates are edited in the same Quill-based Editor as documents; placeholder resolution is done by the backend when the template is used.

Key features include:

  - **Template types** 1–6 (Email - General, Study Session, Assignment, Document - General, Document - Study, Email - Study Close), each with a fixed set of placeholders resolved at runtime.
  - **Multi-language content** stored in ``template_language_content``; default language on the ``template`` row.
  - **TemplateEditor** and **TemplateConfigurator** (Placeholders sidebar) shown when the Editor is opened with a template (``templateId`` provided).
  - **Toolbar and editor behavior** controlled by the same settings as the document editor (see :ref:`Editor Settings <editor-settings-ref>`).

Overview
--------

Templates are listed and created from **Dashboard → Templates** (nav from ``nav_element``; see migration ``extend-nav_element-templates``).

Location: ``frontend/src/components/dashboard/Templates.vue``

When you open a template for editing, the Editor loads with ``templateId`` provided; it renders the :doc:`editor` (TemplateEditor) for the main content and, for email types (1, 2, 3, 6), a **Placeholders** sidebar so you can insert allowed placeholders (e.g. ``~username~``, ``~link~``) into the text.

Location: ``frontend/src/components/editor/sidebar/TemplateConfigurator.vue``

Backend storage:

- **template** — name, type, published, defaultLanguage, userId.  
- **template_language_content** — content (Quill Delta) per template and language.  
- **template_edit** — draft edits per template and language.  
- **template_placeholder_mapping** — placeholder keys and labels per template type (used by the frontend sidebar; resolution rules live in the resolver).

Location: ``backend/utils/templateResolver.js``

Placeholder resolution is implemented there: ``resolveTemplate`` (returns HTML for emails) and ``resolveTemplateToDelta`` (returns Delta for document creation).  
Only placeholders listed in ``PLACEHOLDERS_BY_TYPE`` for the template's type are substituted at runtime.

Implementing the Template Editor
---------------------------------

The main Editor provides ``templateId`` via ``provide`` and conditionally shows the Placeholders sidebar when the document is a template with placeholders.  
TemplateEditor and TemplateConfigurator are used inside this Editor when editing a template.

Location:

- ``frontend/src/components/editor/Editor.vue``
- ``frontend/src/components/editor/template/TemplateEditor.vue``
- ``frontend/src/components/editor/sidebar/TemplateConfigurator.vue``

.. code-block:: html

    <TemplateEditor v-if="templateId" />
    <template v-if="templateId && template && !readOnlyOverwrite && hasPlaceholders" #templateConfigurator>
      <TemplateConfigurator />
    </template>


Template Types and Placeholders Resolved at Runtime
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

At resolution time, only the following placeholder keys are substituted (source: ``PLACEHOLDERS_BY_TYPE`` in ``backend/utils/templateResolver.js``).

- **Type 1 (Email - General):** ``username``, ``firstName``, ``lastName``, ``link``  
- **Type 2 (Email - Study Session):** ``username``, ``link``  
- **Type 3 (Email - Assignment):** ``username``, ``assignmentType``, ``assignmentName``, ``link``  
- **Type 4 (Document - General):** none  
- **Type 5 (Document - Study):** none  
- **Type 6 (Email - Study Close):** ``username``, ``studyName``

Where Each Type Is Used
~~~~~~~~~~~~~~~~~~~~~~~

- **Type 1** — Auth/system emails: settings ``email.template.passwordReset``, ``email.template.verification``, ``email.template.registration``. Location: ``auth.js``  
- **Type 2** — Session start/finish emails: settings ``email.template.sessionStart``, ``email.template.sessionFinish``. Location: ``study_session.js``  
- **Type 3** — Assignment emails: setting ``email.template.assignment``. Location: ``assignment.js``  
- **Type 4** — Pre-fill document content when creating a document with ``templateId`` (``createDocument``). Location: ``document.js``  
- **Type 5** — Document template for a study step (when creating document from template). Location: ``study_step.js``  
- **Type 6** — Study-closed emails: setting ``email.template.studyClosed`` (``sendStudyClosedEmails``). Location: ``study.js``

Adding a New Template Type or Placeholder
-----------------------------------------

1. **Backend:** Add or extend rows in ``template_placeholder_mapping`` via a migration (template type and placeholder key).  
   Update ``PLACEHOLDERS_BY_TYPE`` and ``buildReplacementMap`` in ``backend/utils/templateResolver.js`` so the new key is filled from context.  
   If the new type is used from a specific feature (e.g. study close uses type 6), add or adjust the call site to pass the correct context.

2. **Frontend:** Add the type label and any placeholder descriptions (e.g. ``templateTypeName``, ``placeholderConfigs``, ``longDescriptions``). For the type to appear in the create flow, add it to the type dropdown.

   Location:

   - ``frontend/src/components/editor/sidebar/TemplateConfigurator.vue``
   - ``frontend/src/components/dashboard/templates/TemplateModal.vue``

3. **Access:** Ensure ``getUserFilter`` allows the right visibility for the new type (e.g. admin-only for email types, or document types for non-admins).

   Location: ``backend/db/models/template.js``

Settings
--------

The template editor uses the same toolbar and edit settings as the document editor.  
See :ref:`Editor Settings <editor-settings-ref>` in the :doc:`editor` documentation and :ref:`Adding a New Setting <add-setting-example-ref>` in :doc:`../../examples/settings` if you need to add or change a setting key.
