Email and Document Templates
=============================

This section describes **email and document content templates** in CARE.  
These are different from **study templates** (saved study configurations): content templates define the text of emails (e.g. password reset, session links, study closed) and the initial body of documents created from a template.

You manage content templates from **Dashboard → Templates**.  
They are used for:

- System emails (password reset, verification, registration)
- Session start and session finish emails
- Assignment emails (when a reviewer is assigned to a task)
- Study-closed emails (when a study is closed and participants with open sessions are notified)
- Pre-filled document content when creating a new document from a template

When to Use Which Template Type
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Each template has a **type** that determines where it can be used and which **placeholders** (e.g. ``~username~``, ``~link~``) are replaced when the template is sent or applied.  
Only the placeholders listed below for each type are actually replaced; others will appear as literal text or be empty.

**Email - General (type 1)**  
Used for system emails. Assign the template in **Dashboard → Settings** to the keys for password reset, verification, or registration.  
Placeholders that are replaced: ``~username~``, ``~firstName~``, ``~lastName~``, ``~link~``.

**Email - Study Session (type 2)**  
Used for emails when a session is started or finished. Assign the template in Settings to **Session start** and **Session finish**.  
Placeholders that are replaced: ``~username~``, ``~link~``.

**Email - Assignment (type 3)**  
Used when a reviewer is assigned to a document or submission. Assign the template in Settings to **Assignment**.  
Placeholders that are replaced: ``~username~``, ``~assignmentType~``, ``~assignmentName~``, ``~link~``.

**Email - Study Close (type 6)**  
Used when a study is closed and participants who still had an open session are notified. Assign the template in Settings to **Study closed**; the study must have **Enable Study Close Email Notifications** turned on (see **Checkboxes So Emails Actually Get Sent** below).  
Placeholders that are replaced: ``~username~`` (the session owner), ``~studyName~``.

**Document - General (type 4)** and **Document - Study (type 5)**  
Used when creating a new document and pre-filling its content from a template. No placeholders are replaced; use these for static boilerplate.  
Type 4 is for general documents; type 5 is for documents used in studies.

Flow to Create and Use a Template
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

1. **Create:** In the Dashboard, open **Templates** and click **Add**. Choose the **type** and enter a name (and description).  
2. **Edit:** Open the template. Write the body; for email types, use the **Placeholders** sidebar to insert allowed placeholders (e.g. ``~username~``, ``~link~``) where they should be replaced.  
3. **Assign:** In **Dashboard → Settings**, open the section that contains the **email template** settings. You will see one setting per email use (e.g. password reset, session start, session finish, assignment, study closed). Each is a **dropdown**: choose a template from the list, or leave **None (use default email)** to use the built-in text. For **document templates** (types 4 and 5), you do not assign them in Settings; choose a template when **creating a document** (e.g. Dashboard → Documents → Create).  
4. **Publish (optional):** Publishing makes the template visible to other users. Once published, it cannot be unpublished or deleted (see below).

If you leave a template setting at **None (use default email)** or the system cannot load the template, CARE uses a **default (fallback) email** for that feature, so the action (e.g. sending the email) still completes with built-in text. To use your own text, assign a template and ensure the relevant checkbox below is enabled.

Checkboxes So Emails Actually Get Sent
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

For template-based emails to be sent, the relevant option must be enabled:

- **Session start and session finish emails** — The **study** must have **Enable Email Notifications** turned on. When creating or editing the study (e.g. in the study coordinator), enable the **Enable Email Notifications** switch; otherwise session start/finish emails are not sent even if you assigned templates in Settings.
- **Study closed emails** — The **study** must have **Enable Study Close Email Notifications** (or "Send study closed emails") turned on. In the study settings, enable that switch; otherwise study-closed emails are not sent even if you assigned a template in Settings.
- **Assignment emails** — When creating assignments (**Single Assignment** or **Bulk Assignment** from the Studies dashboard), you must **check the option to send email notifications** (e.g. "Send email notification") in that modal before confirming. If it is unchecked, no assignment emails are sent even if you assigned a template in Settings.

Where Templates Are Used
~~~~~~~~~~~~~~~~~~~~~~~~

- **System/auth emails** — Settings (password reset, verification, registration).  
- **Session start and session finish emails** — Sent when a participant starts or finishes a session; template set in Settings; study must have **Enable Email Notifications** on.  
- **Assignment emails** — Sent when a reviewer is assigned; template set in Settings; checkbox in Single/Bulk Assignment modal must be checked when creating the assignment.  
- **Study closed emails** — Sent when a study is closed to participants with open sessions; template set in Settings; study must have **Enable Study Close Email Notifications** on.  
- **Document creation** — When creating a document, you can select a document template (type 4 or 5) to pre-fill the content.

Publishing and Deletion
~~~~~~~~~~~~~~~~~~~~~~~

**Publishing** makes an email template (types 1, 2, 3, 6) visible to other users.  
**Once a template is published:**

- It **cannot be unpublished**.  
- It **cannot be deleted**.

This is enforced so that templates already in use (e.g. referenced in Settings or in studies) are not removed, which would break those features.  
If you need a different version, create a new template or duplicate an existing one, and avoid publishing until the content is final.

Errors and Placeholders Not Replaced
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Wrong template type**  
If you change the type of a template after writing content, placeholders that are not allowed for the new type will **not** be replaced when the template is used (they may appear as literal ``~name~`` or empty).  
Choose the correct type when creating the template.

**Document templates (types 4 and 5)**  
No placeholders are replaced in document templates. Any ``~...~`` in the text will remain as-is.
