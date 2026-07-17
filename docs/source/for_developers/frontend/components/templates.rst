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

When you open a template for editing, the Editor loads with ``templateId`` provided; it renders the :doc:`editor` (TemplateEditor) for the main content and, for email types (1, 2, 3, 6), a **Placeholders** sidebar so you can insert allowed placeholders (e.g. ``~username~``, ``~link~``) into the text.

Location: ``frontend/src/components/editor/sidebar/TemplateConfigurator.vue``

Backend storage:

- **template** — name, type, public, defaultLanguage, userId.  
- **template_content** — content (Quill Delta) per template and language.  
- **template_edit** — draft edits per template and language.  
- **placeholder** — placeholder keys and labels per template type (used by the frontend sidebar; resolution rules live in the resolver).

Location: ``backend/utils/templateResolver.js``

Placeholder resolution is implemented there: ``resolveTemplate`` (returns HTML for emails) and ``resolveTemplateToDelta`` (returns Delta for document creation).  
Only placeholders listed in ``PLACEHOLDERS_BY_TYPE`` for the template's type are substituted at runtime.

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

**Required placeholders:** For email types (1, 2, 3, 6, 7), stable ``template_content`` in every language must include all required placeholders (``getMissingRequiredPlaceholders`` in ``backend/utils/templateResolver.js``). Enforcement points:

- **Editor save:** ``saveTemplate`` rejects merges that omit required placeholders. The user may confirm discard; ``templateDiscardDrafts`` soft-deletes draft rows without updating ``template_content``.
- **Publish:** The ``template`` model ``beforeUpdate`` hook calls ``assertStableEmailTemplateContent`` when ``public`` becomes ``true``.
- **Settings:** ``validateEmailTemplateSettings`` in ``backend/webserver/utils/settingSave.js`` runs before persisting ``email.template.*`` keys (missing placeholders in any language row blocks assignment).

**Tab close / full reload:** ``beforeunload`` on ``TemplateEditor`` shows the browser's generic leave warning; the route guard does not run. Orphan drafts may remain until the next visit.

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

Adding a New Template Type or Placeholder
-----------------------------------------

.. note::

   Placeholders marked with ``*`` in the table above are **required** for that type.
   If a required placeholder is missing from stable content in any language, validation
   fails on editor save, publish, or Settings assignment until it is added. The set of
   required placeholders is defined in the ``placeholder`` table (``required: true``) and
   enforced via ``getMissingRequiredPlaceholders`` and ``assertStableEmailTemplateContent``
   in ``backend/utils/templateResolver.js``.

Here is a concrete example for adding a new placeholder (e.g. ``studyEndDate`` for type 6):

1. **Backend (DB + resolver):**

   - Add a row to the ``placeholder`` table via a migration:

     - ``type``: ``6`` (Email - Study Close)
     - ``placeholderKey``: ``studyEndDate``
     - other metadata as needed (label, required, etc.)

   - Update ``PLACEHOLDERS_BY_TYPE`` / ``buildReplacementMap`` in
     ``backend/utils/templateResolver.js`` to fill ``studyEndDate`` from context, for example:

     - In the resolver, when ``context.templateType === 6``, set
       ``replacements["~studyEndDate~"] = <value from study or session>``.

   - If the new placeholder is driven by a specific feature (e.g. study close emails),
     ensure the call site (e.g. ``sendStudyClosedEmails`` in ``study.js``) passes
     whatever additional data is needed into the resolver context.

2. **Frontend (editor + sidebar):**

   - Add the placeholder to the template configurator configuration so it appears in the
     Placeholders sidebar with a name/description (e.g. update
     ``placeholderConfigs`` / ``longDescriptions`` in
     ``frontend/src/components/editor/sidebar/TemplateConfigurator.vue``).



3. **Access / type visibility:**

   - If the new placeholder is tied to a new template type, also update:

     - The template type dropdown in ``frontend/src/components/dashboard/templates/TemplateModal.vue``.
     - ``getUserFilter`` in ``backend/db/models/template.js`` so that only the correct
       users (e.g. admins) see or can use that type.

Settings
--------

The template editor uses the same toolbar and edit settings as the document editor.  
See :ref:`Editor Settings <editor-settings-ref>` in the :doc:`editor` documentation and :ref:`Adding a New Setting <add-setting-example-ref>` in :doc:`../../examples/settings` if you need to add or change a setting key.
