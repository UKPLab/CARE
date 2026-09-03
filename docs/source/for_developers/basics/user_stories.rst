User Stories
============

User stories describe the platform from the perspective of the people who use it. Each story
follows the format *"As a [role], I want [action], so that [benefit]"* and includes acceptance
criteria that can be used directly as test cases. Stories are grouped by feature area.
Roles used are: **Admin**, **Coordinator**, **Participant**, and **Guest**.

**Structure of each story:**

- The **Story** field states who wants what and why.
- The **Acceptance** field contains testable criteria — either as *Given / When / Then* steps
  (for behavior that depends on system state) or as a checklist (for configuration, display,
  or permission requirements). Negative cases are always included.
- The optional **Settings** field lists the setting keys that enable, restrict, or configure the described behaviour.

Authentication
~~~~~~~~~~~~~~

-----

First-Time Setup Wizard
-----------------------

.. container:: user-story

   :Story:
     I as an administrator, am guided through an initial setup wizard on a fresh CARE instance instead of being dropped into fragmented configuration screens.

   :Acceptance:
     When no admin account exists, opening CARE leads to a setup wizard with steps for admin account creation, general settings, mail settings, registration settings, and a summary. I can move through the steps, review values on summary, and finish setup. After completion, the instance is marked as configured and normal login/dashboard access is used.

-----

Import Setup Settings from JSON
-------------------------------

.. container:: user-story

   :Story:
     I as an administrator, can import setup values from a JSON file exported from another CARE instance to avoid re-entering settings manually.

   :Acceptance:
     In setup wizard steps after admin creation, I can open the import modal and select a JSON file with setting key/value pairs. Valid keys are loaded into the wizard state and reflected on the summary page. Unknown keys are ignored and this is shown in feedback. If the file is invalid JSON, I receive an error message and no values are imported.

-----

Export Setup Settings to JSON
-----------------------------

.. container:: user-story

   :Story:
     I as an administrator, can export the current setup configuration as a JSON snapshot to reuse it in another CARE instance.

   :Acceptance:
     In setup wizard steps after admin creation, I can use the download action to export a JSON file containing the current setup values. The exported file can be used as input for the setup import flow on another instance.

-----

Test Mail During Setup
----------------------

.. container:: user-story

   :Story:
     I as an administrator, can test mail delivery during setup before finishing the wizard.

   :Acceptance:
     In the mail step, I can enter a recipient address and trigger a test email. I receive clear success or error feedback based on the response of the test mail endpoint and can continue editing mail settings before finishing setup.

-----

Landing Page
------------

.. container:: user-story

   :Story:
     As a **Guest**, I want to see a landing page when I open the application, so that I know
     how to log in, register, or access documentation.

   :Settings:
     ``app.landing.showDocs``, ``app.landing.showFeedback``, ``app.landing.showProject``,
     ``app.register.enabled``, ``app.config.copyright``

   :Acceptance:
     - The landing page loads at the root URL.
     - A login button or form is visible.
     - A link to the documentation is visible (if ``app.landing.showDocs`` is enabled).
     - A registration button is visible (if ``app.register.enabled`` is enabled).
     - If both documentation and registration links are disabled via settings, the page still
       loads with at least the login option.

-----

User Login
----------

.. container:: user-story

   :Story:
     As a **Participant**, I want to log in with my username or email and password, so that I
     can access my personal dashboard.

   :Acceptance:
     Given I am on the login page,
     When I enter a valid username or email and the correct password and click login,
     Then I am redirected to my dashboard and my name abbreviation is shown as a circle in the
     top right. When I click on it, my username is visible.

     **Negative cases:**

     - When I enter wrong credentials, I see an error message and remain on the login page.
     - When my account has email verification enabled but my email is not yet verified, I see
       a message telling me to verify my email first.
     - When I enter no credentials and click login, I see a validation error.

-----

Logout
------

.. container:: user-story

   :Story:
     As a **Participant**, I want to log out of the application, so that my session is closed
     and others cannot access my account.

   :Acceptance:
     Given I am logged in,
     When I click on my name abbreviation in the top right and select logout,
     Then I am redirected to the login page and my session is closed.

     **Negative cases:**

     - After logging out, navigating back via the browser does not restore my session — I am
       redirected to the login page.

-----

Guest Login
-----------

.. container:: user-story

   :Story:
     As a **Guest**, I want to log in without creating an account, so that I can access the
     platform with limited functionality.

   :Settings:
     ``app.login.guest``

   :Acceptance:
     - A "Login as guest" button is visible on the login page.
     - Clicking it logs me in immediately without entering credentials.
     - I can see the dashboard with the rights and views assigned to the guest role.

     **Negative cases:**

     - When ``app.login.guest`` is disabled, the button is not shown on the login page.

-----

LDAP Login
----------

.. container:: user-story

   :Story:
     As a **Participant**, I want to log in using my institutional LDAP account, so that I
     don't need a separate CARE password.

   :Settings:
     ``system.auth.ldap.enabled``

   :Acceptance:
     Given LDAP login is enabled and I am on the login page,
     When I navigate to the LDAP login page and enter my institutional credentials,
     Then I am logged in and redirected to my dashboard.

     **Negative cases:**

     - When I enter invalid LDAP credentials, I see an error message and remain on the login
       page.
     - When ``system.auth.ldap.enabled`` is disabled, the LDAP login option is not shown.
     - When the LDAP provider is configured but not reachable, I see a service unavailable
       message.

-----

SAML Login
----------

.. container:: user-story

   :Story:
     As a **Participant**, I want to log in using my institutional SAML account, so that I
     can authenticate with my existing organisational identity.

   :Settings:
     ``system.auth.saml.enabled``

   :Acceptance:
     Given SAML login is enabled and I am on the login page,
     When I click the SAML login button and complete the SAML authentication flow,
     Then I am redirected back to CARE and logged into my dashboard.

     **Negative cases:**

     - When I cancel the SAML flow, I am returned to the login page without being logged in.
     - When ``system.auth.saml.enabled`` is disabled, the SAML login button is not shown.
     - When the SAML provider is not reachable, I see a service unavailable message.

-----

ORCID Login
-----------

.. container:: user-story

   :Story:
     As a **Participant**, I want to log in using my ORCID account, so that I can authenticate
     with my existing researcher identity.

   :Settings:
     ``system.auth.orcid.enabled``

   :Acceptance:
     Given ORCID login is enabled and I am on the login page,
     When I click the ORCID login button and complete the ORCID OAuth flow,
     Then I am redirected back to CARE and logged into my dashboard.

     **Negative cases:**

     - When I cancel the ORCID OAuth flow, I am returned to the login page without being
       logged in.
     - When ``system.auth.orcid.enabled`` is disabled, the ORCID login button is not shown.
     - When the ORCID provider is not reachable, I see a service unavailable message.

-----

Two-Factor Authentication Login
--------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to verify my identity with a second factor after entering my
     password, so that my account is protected even if my password is compromised.

   :Settings:
     ``system.auth.local.2fa.required``, ``system.auth.ldap.2fa.required``,
     ``system.auth.saml.2fa.required``, ``system.auth.orcid.2fa.required``

   :Acceptance:
     Given I have 2FA enabled on my account and I have entered valid credentials,
     When the system prompts me for a second factor,
     Then I can select my preferred method (email OTP or TOTP) and submit the code to complete
     login.

     - For email OTP: a 6-digit code is sent to my email, valid for 10 minutes. I can request
       a new code after 60 seconds.
     - For TOTP: I enter the current 6-digit code from my authenticator app.
     - After successful verification I am redirected to my dashboard.

     **Negative cases:**

     - When I enter a wrong code, I see an error with the number of remaining attempts.
     - After 5 failed attempts my session is invalidated and I must log in again from the
       start.
     - When an email OTP has expired (>10 min), submitting it shows an expiry error.
     - When I try to resend an OTP within 60 seconds, I see a cooldown message.

-----

Two-Factor Authentication Setup
--------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to enable two-factor authentication on my account, so that
     I can add an extra layer of security to my login.

   :Settings:
     ``system.auth.local.2fa.required``, ``system.auth.ldap.2fa.required``,
     ``system.auth.saml.2fa.required``, ``system.auth.orcid.2fa.required``

   :Acceptance:
     - When I click on my name abbreviation in the top right, a small menu appears with a
       "Configure 2FA" option. Clicking it opens a modal.
     - In the modal I can enable 2FA via email OTP or TOTP (or both).
     - For email OTP: enabling it adds "email" to my active 2FA methods immediately.
     - For TOTP: I am shown a QR code to scan with my authenticator app, and an alternative
       manual entry code for apps that do not support scanning. After scanning or entering the
       key, I must submit the first valid 6-digit code to confirm setup. Only after successful
       verification is TOTP activated.
     - I can disable any active 2FA method from the same modal.

     **Negative cases:**

     - When I try to confirm TOTP setup with a wrong code, setup is rejected and the secret
       is not saved.
     - When I disable a 2FA method, the corresponding data (OTP or TOTP secret) is cleared.

-----

Consent and Terms
-----------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to review and accept the platform terms and consent options
     on first login, so that I can make an informed choice about my data before using the
     platform.

   :Settings:
     ``app.register.terms``, ``app.register.requestStats``, ``app.register.requestData``

   :Acceptance:
     - On first login a modal appears showing the platform terms and optional checkboxes for
       behaviour statistics and data sharing (shown only if the respective settings are
       enabled).
     - I must accept the terms to proceed. The optional checkboxes are pre-set to their
       configured default values but I can change them.
     - After accepting, my preferences are saved and I am granted access to the app.
     - I can later update my consent preferences via the same modal accessible from my account
       menu.

     **Negative cases:**

     - If I decline the terms, I am logged out and returned to the login page.

-----

Password Reset
--------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to reset my password via email, so that I can regain access
     to my account if I have forgotten my password.

   :Settings:
     ``app.login.forgotPassword``

   :Acceptance:
     - A "Forgot password?" link is visible on the login page.
     - Clicking it shows a form where I can enter my email address.
     - After submitting, I receive an email with a password reset link (valid for 1 hour).
     - I can request a new reset email at most once every 5 minutes.
     - Clicking the link in the email opens a form where I can enter and confirm a new password.
     - After successfully setting a new password, I am redirected to the login page with a
       confirmation message.

     **Negative cases:**

     - When ``app.login.forgotPassword`` is disabled, the "Forgot password?" link is not shown.
     - When I enter an email address that is not registered, the form shows the same success
       message (no account enumeration).
     - When I try to request a second reset email within 5 minutes, I see a cooldown message.
     - When I click an expired or already-used reset link, I see an error and am directed to
       request a new one.

-----

Registration
~~~~~~~~~~~~

-----

User Registration
-----------------

.. container:: user-story

   :Story:
     As a **Guest**, I want to register a new account, so that I can access the platform as
     a registered user.

   :Settings:
     ``app.register.enabled``, ``app.register.requestName``

   :Acceptance:
     - A registration button or link is visible on the landing/login page.
     - The registration form asks for a username, email address, and password.
     - If ``app.register.requestName`` is enabled, the form additionally asks for my real name.
     - If ``app.register.terms`` is enabled, I must accept the terms before my account is
       created.
     - If ``app.register.emailVerification`` is disabled, my account is created immediately
       and I am logged in.
     - If ``app.register.emailVerification`` is enabled, I receive a verification email and
       must confirm my address before I can log in.

     **Negative cases:**

     - When ``app.register.enabled`` is disabled, no registration button or link is shown.
     - When I submit the form with an already-registered email or username, I see an error
       message.
     - When I submit the form with a missing required field, I see a validation error.
     - When I submit the form with a password that does not meet the minimum requirements, I
       see an error describing the requirements.
     - When email verification is enabled and I try to log in before verifying, I see a
       message telling me to check my email.

-----

Email Verification
------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to verify my email address after registration, so that my
     account is confirmed and I can log in.

   :Settings:
     ``app.register.emailVerification``

   :Acceptance:
     - After registration, I receive an email with a verification link.
     - Clicking the link confirms my email address and redirects me to the login page with a
       success message.
     - If I did not receive the email, I can request a new verification email from the login
       page (rate-limited to one request every ``app.register.emailVerificationRateLimit``
       minutes).

     **Negative cases:**

     - When I click an expired or already-used verification link, I see an error and am
       offered the option to request a new one.
     - When I request a new verification email before the rate limit has elapsed, I see a
       cooldown message.
     - When ``app.register.emailVerification`` is disabled, no verification step exists and
       the link in any previously sent email has no effect.

-----

Document Management
~~~~~~~~~~~~~~~~~~~

-----

Upload a Document
-----------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to upload a PDF or ZIP file to the platform, so that it is
     available for annotation or review.

   :Acceptance:
     - From the document list, I can click an upload button and select a PDF or ZIP file.
     - After uploading, the document appears in my document list with its filename and upload
       date.
     - I can optionally have embedded annotations imported from the PDF during upload.

     **Negative cases:**

     - When I try to upload a file with an unsupported type, I see an error and the upload is
       rejected.
     - When the upload fails due to a server error, I see an error message and the document
       does not appear in the list.

-----

Rename and Delete a Document
-----------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to rename or delete a document I own, so that I can keep
     my document list organised.

   :Acceptance:
     - I can rename a document using its action buttons in the document list.
     - I can delete a document using its action buttons. A confirmation dialog is shown before
       the document is removed.

     **Negative cases:**

     - When I try to rename a document to an empty name, I see a validation error.
     - When I cancel the delete confirmation dialog, the document is not deleted.

-----

Open a Document in the Annotator
----------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to open a document in the annotator, so that I can read
     and annotate its content.

   :Acceptance:
     - I can open a document from the document list using its action buttons.
     - The annotator opens and displays the PDF content.
     - I can navigate through the document by scrolling.

     **Negative cases:**

     - When the document file is missing or corrupted, I see an error message instead of
       the PDF.

-----

Create an HTML Document
------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to create a new HTML document directly in the platform, so
     that I can write and edit content without uploading a file.

   :Settings:
     ``editor.document.showButtonCreate``

   :Acceptance:
     - A "Create document" button is visible in the document list.
     - Clicking it creates a new empty HTML document and opens it in the editor.
     - The document appears in my document list.

     **Negative cases:**

     - When ``editor.document.showButtonCreate`` is disabled, the create button is not shown.

-----

Manage Tags and Tag Sets
-------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to create and manage tags and tag sets, so that I can use
     them when annotating documents.

   :Acceptance:
     - From the dashboard, I can create a tag set with a name.
     - Within a tag set, I can add individual tags, each with its own name and color.
     - I can rename and delete tag sets and individual tags I own.
     - I can copy a tag set owned by another user to use as a starting point for my own.
     - I can set one tag set as the default for documents.
     - In the annotator, when I highlight text, I can directly select a tag from the default
       tag set to label the annotation.

     **Negative cases:**

     - When I try to create a tag or tag set with an empty name, I see a validation error.

-----

Publish a Tag Set
------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to publish a tag set, so that other users can see and use
     it for their annotations.

   :Acceptance:
     - From the tag set list, I can publish a tag set I own.
     - Publishing requires explicit confirmation as the action is permanent and cannot be
       undone.
     - Once published, the tag set is visible to all users.

-----

Publish a Document
-------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to publish a document, so that other logged-in users can
     access it.

   :Acceptance:
     - From the document list, I can publish a document I own.
     - Once published, other logged-in users can open the document via its URL.

-----

Annotator
~~~~~~~~~

-----

Create an Annotation
---------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to create an annotation by highlighting text in the
     annotator, so that I can mark and label relevant passages in a document.

   :Acceptance:
     - I can select text in the PDF and a popup appears allowing me to create an annotation.
     - I must select a tag from the default tag set to confirm the annotation.
     - The annotation is saved and the highlighted text is visible in the document.
     - The new annotation appears in the annotation list in the sidebar.
     - After creating an annotation, I can add a comment to it from the sidebar.

     **Negative cases:**

     - When I move the mouse away from the highlighted text or click elsewhere in the document
       without selecting a tag, no annotation is saved.

-----

Edit and Delete an Annotation
-------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to edit or delete an annotation I created, so that I can
     correct mistakes or remove irrelevant highlights.

   :Acceptance:
     - I can change the tag of an existing annotation I own from the sidebar.
     - I can delete an annotation I own from the sidebar. A confirmation is shown before
       deletion.
     - After deletion, the highlight is removed from the document and the annotation
       disappears from the sidebar list.

     **Negative cases:**

     - When I try to delete an annotation I do not own, the delete action is not available.
     - When I cancel the deletion confirmation, the annotation is not deleted.

-----

Navigate and Toggle Annotations
---------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to navigate through and toggle the visibility of
     annotations, so that I can review marked passages and control what is highlighted in
     the document.

   :Acceptance:
     - All annotations for the current document are listed in the sidebar.
     - I can click an annotation in the sidebar and the document scrolls to the corresponding
       highlight.
     - I can hide an individual annotation; its highlight in the PDF disappears immediately.
     - I can show a hidden annotation again; its highlight reappears in the PDF.

     **Negative cases:**

     - When a document has no annotations, the sidebar shows an empty state message.

-----

Add and Reply to Comments
--------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to add comments to annotations and reply to existing
     comments, so that I can discuss the content with others.

   :Acceptance:
     - I can add a comment to an annotation from the sidebar.
     - I can reply to an existing comment on an annotation.
     - Comments and their replies are displayed in a threaded view under the annotation.
     - I can edit or delete a comment I authored.

     **Negative cases:**

     - When I try to submit an empty comment, the action is rejected.
     - When I try to edit or delete a comment I did not author, the action is not available.

-----

Expand and Collapse Comment Replies
-------------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to expand and collapse replies on a comment, so that I can
     focus on the content that matters without being overwhelmed by long threads.

   :Settings:
     ``annotator.comments.defaultNumsShown.levelZero``,
     ``annotator.comments.defaultNumsShown.levelOneUp``

   :Acceptance:
     - Each comment has a chevron icon that collapses or expands its content and replies.
     - By default, only a limited number of replies are shown per comment, controlled by the
       ``defaultNumsShown`` settings.
     - A **Show more** button appears when there are more replies than the current limit;
       clicking it loads additional replies five at a time.
     - A **Show less** button appears when more replies are loaded than the default; clicking
       it returns to the default count.
     - A **Hide replies** button collapses all replies and resets the count to the default.

-----

Vote on Comments
-----------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to vote on comments, so that I can express agreement or
     disagreement without writing a reply.

   :Settings:
     ``annotator.comments.votes.enabled``, ``annotator.comments.votes.onlyUpvote``

   :Acceptance:
     - Each comment shows upvote and downvote buttons with the current vote count.
     - I can cast one vote (up or down) per comment.
     - Clicking the same button again removes my vote.
     - I cannot upvote and downvote the same comment at the same time — casting the opposite
       vote replaces my current one.

     **Negative cases:**

     - When ``annotator.comments.votes.enabled`` is disabled, vote buttons are not shown.
     - When I try to vote on my own comment, the action is not available.

-----

Collaboration — Respond to Annotations
----------------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to mark my response state on an annotation, so that I can
     track which annotations I have reviewed or responded to.

   :Settings:
     ``annotator.collab.response``

   :Acceptance:
     - Each annotation in the sidebar shows a response state indicator.
     - I can set my response state on an annotation (e.g. open, in progress, resolved).
     - My response state is saved and visible to me on subsequent visits.

     **Negative cases:**

     - When ``annotator.collab.response`` is disabled, the response state indicator is not
       shown.

-----

Document Notes
---------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to write a free-text note for a document, so that I can
     capture overall observations that are not tied to a specific highlight.

   :Acceptance:
     - A button at the top of the annotation list in the sidebar allows me to open and write
       a note for the current document.
     - My note is saved and persists across sessions.
     - I can edit or clear my note at any time.

-----

Download Annotations from the Annotator
-----------------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to download the annotations visible in the annotator
     sidebar, so that I can process or archive them locally.

   :Settings:
     ``annotator.download.enabledBeforeStudyClosing``

   :Acceptance:
     - A download button in the annotator sidebar lets me export the currently visible
       annotations as a JSON file.
     - Outside a study session, the download is always available.
     - Inside a study session, the download is only available if
       ``annotator.download.enabledBeforeStudyClosing`` is enabled or the study is already
       closed.
     - When ``annotator.download.enabledBeforeStudyClosing`` is disabled, annotations from
       still-open study sessions are excluded from the annotation list entirely.

-----

Download PDF with Embedded Annotations
----------------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to download a PDF with my annotations embedded directly
     in the file, so that I can share an annotated version without needing access to CARE.

   :Settings:
     ``editor.document.showButtonPDFDownload``

   :Acceptance:
     - From the annotator or document list, I can open a download dialog.
     - I can choose whether to include annotations embedded in the PDF.
     - The downloaded file reflects the document with or without annotations as selected.

-----

Real-time Collaborative Annotation
------------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to annotate a document simultaneously with other users
     in real time, so that we can collaboratively review the same document together.

   :Acceptance:
     - When a study is configured with collaborative mode, all participants in that study
       annotate the same document and see each other's highlights and comments as they are
       created.
     - An indicator is shown when another user is currently editing a comment.

-----

HTML Editor
~~~~~~~~~~~

-----

Edit an HTML Document
----------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to edit the content of an HTML document in the platform
     editor, so that I can write and format text directly in the browser.

   :Settings:
     ``editor.toolbar.visibility``

   :Acceptance:
     - Opening an HTML document launches the editor with the current content loaded.
     - I can write and format text using the editor toolbar (e.g. bold, italic, headings,
       lists).
     - Changes are saved automatically as I type.

-----

View Document Edit History
---------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to view the edit history of an HTML document, so that I
     can see how the content looked at any point in time.

   :Settings:
     ``editor.edits.showHistoryForUser``

   :Acceptance:
     - From the editor, I can open a history view listing all saved versions of the document.
     - I can click on any history entry to see the document content as it was at that point
       in read-only mode.

     **Negative cases:**

     - When a document has no prior versions, the history view shows an empty state.

-----

Download an HTML Document
--------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to download an HTML document, so that I can keep a local
     copy of the content.

   :Settings:
     ``editor.document.showButtonHTMLDownload``, ``editor.document.showButtonDeltaDownload``

   :Acceptance:
     - From the editor or document list, I can download the document.
     - The downloaded file contains the current content of the document.

-----

Study Management
~~~~~~~~~~~~~~~~

-----

Create a Study
---------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to create a new study, so that I can deploy an existing
     workflow for participants to complete.

   :Settings:
     ``app.study.enabled``

   :Acceptance:
     - From the dashboard, I can create a new study by providing at minimum a name,
       description, and selecting an existing workflow. Additional configuration options are
       available.
     - After creation, the study appears in my study list.

     **Negative cases:**

     - When I try to create a study with an empty name, I see a validation error.
     - When ``app.study.enabled`` is disabled, the option to create a study is not shown.

-----

Start a Study Session
----------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to start or resume a study session via a study link, so
     that I can complete the assigned workflow.

   :Settings:
     ``app.study.enabled``

   :Acceptance:
     - When I open a study link, I can create a new session and start the first step of the
       workflow.
     - If I already have a session for this study and it is resumable, I can continue from
       where I left off.
     - If the study has a time limit, a countdown is shown during the session.
     - Past sessions that are finished, closed, or not resumable are accessible in read-only
       mode.

     **Negative cases:**

     - When the study has reached its maximum total number of sessions, I cannot create a new
       one and see an appropriate message.

-----

Close a Study
--------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to close a study I own, so that no new sessions can be
     started and the study is marked as finished.

   :Settings:
     ``app.study.enabled``

   :Acceptance:
     - From the study dashboard, I can close a study I own.
     - After closing, no new sessions can be created for the study.
     - Participants who open the study link after it is closed see an appropriate message.
     - If study notifications are enabled, participants with active sessions receive a
       notification email when the study is closed.

-----

View Study Sessions Overview
-----------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to see a dedicated dashboard with an overview of all study
     sessions, so that I can track their status and progress.

   :Settings:
     ``app.study.enabled``

   :Acceptance:
     - A dedicated study sessions dashboard shows all sessions across my studies.
     - I can filter sessions to show only open studies.
     - I can filter sessions by workflow type.

     **Negative cases:**

     - When there are no sessions, the dashboard shows an empty state.

-----

Assign a User to a Study Session
----------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to assign a user to a study session, so that they can
     complete the workflow for a specific document.

   :Settings:
     ``app.study.enabled``

   :Acceptance:
     - From the study dashboard, I can create a single assignment by selecting a user and a
       document.
     - The assigned user receives a link or notification to start their session.
     - I can also create bulk assignments for multiple users or documents at once.

-----

Anonymous Study Mode
---------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to enable anonymous mode for a study, so that reviewer
     identities are hidden from other participants during the session.

   :Acceptance:
     - When creating a study, I can enable anonymous mode.
     - In anonymous mode, the identities of other reviewers are not visible to participants
       during their session.

-----

Study Notifications
--------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to receive email notifications about my study session, so
     that I am informed when a session starts, finishes, or the study is closed.

   :Settings:
     ``system.mailService.enabled``

   :Acceptance:
     - When my study session starts, I receive a notification email.
     - When my study session is finished, I receive a notification email.
     - When the study is closed by the owner, I receive a notification email.

-----

Bulk Close Studies
-------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to close multiple studies at once, so that I can
     efficiently mark a batch of studies as finished.

   :Acceptance:
     - From the studies dashboard, I can select multiple studies I own and close them in
       one action.
     - Progress is shown during the bulk close operation.
     - After completion, all selected studies are marked as closed and no new sessions can
       be created for them.

-----

Submit Multiple Times in a Study Session
-----------------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to submit my study session multiple times, so that I can
     update my work after an initial submission.

   :Acceptance:
     - When a study is configured to allow multiple submissions, I can submit my session
       more than once.

-----

Reopen a Participant's Finished Session
-----------------------------------------

.. container:: user-story

   :Story:
     As a **Participant** (study owner), I want to reopen a finished session, so that the
     participant can continue editing their work.

   :Acceptance:
     - From the study sessions overview, I can reopen a finished session belonging to my
       study.
     - After reopening, the participant can continue editing the session.

-----

Create a Copy of a Study Session
----------------------------------

.. container:: user-story

   :Story:
     As a **Participant** (study owner), I want to create a copy of a study session, so
     that I can use it independently without affecting the original session.

   :Acceptance:
     - From the study sessions overview, I can create a copy of a session belonging to a
       study I own.
     - The copy is an independent session with the same content as the original.
     - The original session remains unchanged.

-----

Assessment
~~~~~~~~~~

-----

Configure an Assessment
------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to define an assessment for a study step, so that
     participants can evaluate documents against a defined rubric during their session.

   :Acceptance:
     - For workflow steps that support assessment, I can select an assessment configuration
       when setting up the step.
     - Assessment configurations are created separately under the configurations section
       before they can be selected.

     **Negative cases:**

     - When no assessment configuration has been created, the selection list is empty.

-----

Complete an Assessment During a Session
----------------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to fill in an assessment rubric during my study session,
     so that I can evaluate the document against the defined criteria.

   :Acceptance:
     - During a study session step with an assessment, I see a rubric in the sidebar with
       the defined criteria.
     - For each criterion I can select a score and add a comment.
     - My responses are saved automatically as I complete the rubric.

-----

Submission Management
~~~~~~~~~~~~~~~~~~~~~

-----

Upload a Submission
--------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to upload files for an open assignment, so that they are
     validated and accepted immediately.

   :Acceptance:
     - From the submissions dashboard, I can see all open assignments available for my role.
     - For each open assignment, I can upload the required file(s).
     - Each file is validated during upload and I immediately see whether it was accepted or
       rejected.

     **Negative cases:**

     - When I upload a file that fails validation, I see an error describing why it was
       rejected.
     - When there are no open assignments for my role, the dashboard shows an empty state.

-----

Email Notification on Submission Upload
-----------------------------------------

.. container:: user-story

   :Story:
     As a **Participant** (assignment owner), I want to be notified by email when a
     submission is uploaded for my assignment, so that I can act on it promptly.

   :Settings:
     ``email.template.assignment``

   :Acceptance:
     - When a participant uploads or re-uploads a submission for an assignment I own, I
       receive a notification email.
     - I can disable this notification per assignment using the **Notify on Submission
       Upload** toggle when creating or editing the assignment.
     - An admin can configure the email template used for submission notifications via the
       platform settings.

-----

Manage Submission Assignments
------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to create and manage submission assignments, so that I can
     define which roles can upload files and what validation rules apply.

   :Acceptance:
     - I can create a new submission assignment specifying the target role(s), allowed file
       types, and validation configuration.
     - Created assignments appear in the submissions dashboard for users with the matching
       role.
     - I can close or delete an assignment to stop accepting new uploads.

-----

Moodle Integration
~~~~~~~~~~~~~~~~~~

-----

Import Users from Moodle
-------------------------

.. container:: user-story

   :Story:
     As an **Admin**, I want to import users from Moodle, so that participants do not need
     to register manually.

   :Settings:
     ``system.moodle.enabled``

   :Acceptance:
     - From the admin area, I can trigger a user import from Moodle.
     - Imported users are created in CARE with roles according to the
       `Moodle role mapping <moodle_usage>`_.
     - Already existing users are not duplicated.

     **Negative cases:**

     - When the Moodle connection is not reachable, I see an error message.
     - When ``system.moodle.enabled`` is disabled, the import option is not shown.

-----

Import Submissions from Moodle
-------------------------------

.. container:: user-story

   :Story:
     As a **Coordinator**, I want to import submissions from Moodle, so that student work
     is available in CARE without manual upload.

   :Settings:
     ``system.moodle.enabled``

   :Acceptance:
     - I can trigger a submission import from a Moodle course and assignment.
     - Imported submissions appear in the submissions list and are ready for use in studies.
     - Already imported submissions are not duplicated.

     **Negative cases:**

     - When the Moodle connection is not reachable, I see an error message.

-----

Export Assessment Results to Moodle
-------------------------------------

.. container:: user-story

   :Story:
     As a **Coordinator**, I want to export assessment results to Moodle, so that grades
     are available to students in their Moodle course.

   :Settings:
     ``system.moodle.enabled``

   :Acceptance:
     - I can trigger an export of assessment results to a Moodle course and assignment.
     - Exported results are written back to the corresponding Moodle assignment entries.

     **Negative cases:**

     - When the Moodle connection is not reachable, I see an error message.

-----

Publish Study Session Links via Moodle
---------------------------------------

.. container:: user-story

   :Story:
     As a **Coordinator**, I want to publish study session links to Moodle, so that
     students can access their session for the study that was created from their Moodle
     submission.

   :Settings:
     ``system.moodle.enabled``

   :Acceptance:
     - I can publish session links to Moodle for a study where the sessions are based on
       Moodle submissions.
     - Each student sees the link to their own session in Moodle and can open it directly.

     **Negative cases:**

     - When the Moodle connection is not reachable, I see an error message.

-----

Projects
~~~~~~~~

-----

Manage Projects
----------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to organise my work into projects, so that studies and
     documents are grouped by context.

   :Acceptance:
     - I can create a new project with a name.
     - Studies and documents are created within the currently selected project.
     - I can set a default project that is pre-selected when I create new items.
     - I can publish a project, making it visible to other logged-in users.
     - I can delete a project I own. A confirmation dialog is shown before deletion.

-----

Select Active Project
----------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to select my active project from the topbar, so that all
     content I create or view is scoped to the correct project.

   :Settings:
     ``projects.default``

   :Acceptance:
     - The topbar shows a dropdown with all projects I have access to.
     - Selecting a project immediately scopes the dashboard view (documents, studies,
       assignments) to that project.
     - The selected project is remembered between sessions.

-----

Assign User to a Project
--------------------------

.. container:: user-story

   :Story:
     As an **Admin**, I want to assign a user to a specific project and prevent them from
     switching projects, so that participants work only within the intended project.

   :Settings:
     ``topBar.projects.hideProjectButton``

   :Acceptance:
     - From the admin area, I can assign a default project to one or more users.
     - I can set ``topBar.projects.hideProjectButton`` to ``true`` for selected users via
       the **Change User Settings** dialog so that the project switcher in the topbar is
       hidden for them.
     - When the project button is hidden, the user's active project remains locked to the
       assigned project.

-----

Export
~~~~~~

-----

Export Assessment Results as CSV
----------------------------------

.. container:: user-story

   :Story:
     As a **Coordinator**, I want to download assessment results for a closed study as a
     CSV file, so that I can analyse grades outside of CARE.

   :Acceptance:
     - From the study view, I can open the **Publish Assessment** dialog.
     - I can select one or more workflows to include in the export.
     - I can select the specific sessions to include in the export.
     - The downloaded CSV contains the grading data for the selected sessions and workflows.
     - The export is only available for closed studies.

-----

Export Project Data
--------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to export all data from a project, so that I can analyse
     or archive the results outside of CARE.

   :Acceptance:
     - From the project view, I can trigger a data export that is streamed to the browser
       for download.
     - The export includes all project-related data (e.g. assignment documents, study data,
       annotations).
     - Only data I own is exported.
     - User references in the export use usernames. If I have the right to view private user
       information, additional personal details are included.
     - I can choose **Extract submissions** to download all submissions in the project as a
       ZIP file.
     - I can select which students' submissions to include in the extraction.
     - I can define anonymisation aliases per student; when enabled, filenames use the alias
       instead of real names or usernames.

-----

Anonymise Author in ZIP Export
--------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to anonymise author information when exporting a project
     containing LaTeX documents, so that reviewer identities are hidden in the exported
     files.

   :Acceptance:
     - When exporting a project that contains ZIP/LaTeX documents, I can choose to
       anonymise author information.
     - When enabled, ``\author{}`` fields in ``.tex`` files within the ZIP are replaced
       with anonymised names.

-----

AI and Automation
~~~~~~~~~~~~~~~~~

-----

Manage AI Credentials and Models
--------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to configure AI provider credentials and models, so that
     I can use approved models in CARE.

   :Acceptance:
     - I can create, edit, disable, and delete my credentials and models.
     - I can test a model before using it and share a model with users or roles.
     - Only the owner can change a credential, model, or its sharing.

-----

Configure and Monitor AI Use
----------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to configure AI hooks and spending limits and inspect AI
     usage, so that model calls are controlled and auditable.

   :Acceptance:
     - I can create a hook from a prompt template, choose ordered models, and set its output
       type.
     - I can manage cost limits for models, hooks, studies, and study steps.
     - The AI log shows request status, token usage, and cost.
     - A hook cannot be saved without a prompt template and at least one model.

-----

Automate Events with Triggers
-----------------------------

.. container:: user-story

   :Story:
     As an **Admin**, I want to run configured actions when CARE events occur, so that
     recurring work can be automated.

   :Acceptance:
     - I can create, edit, enable, disable, and delete a trigger by selecting an event and
       action.
     - Trigger Logs shows each run, its status, attempts, and any error message.
     - I can cancel pending or running jobs, retry failed or cancelled jobs, and re-run
       completed jobs.
     - Non-admin users cannot manage triggers or trigger logs.

-----

Admin Features
~~~~~~~~~~~~~~

-----

Customise the Platform Logo
----------------------------

.. container:: user-story

   :Story:
     As an **Admin**, I want to customise the logo background colour, so that the platform
     reflects my institution's branding.

   :Settings:
     ``logo.reBgColor``

   :Acceptance:
     - From the admin settings, I can change the logo background colour.
     - A live preview shows how the logo will look before I save.
     - The updated logo appears on the login page, registration page, and topbar.
     - The logo text colour adjusts automatically to remain readable against the chosen
       background.

-----

Admin Settings
--------------

.. container:: user-story

   :Story:
     I as an admin user want to access and modify the settings of the system in the frontend.
   :Acceptance:
     As an admin, I can see the Settings component in the navigation sidebar. When I access this, I can see the list of settings, reload them from the server backend, make changes and save these on the server. The changes have immediate effect on the behavior of the application.

-----

Wizard-Style Settings Configuration
-----------------------------------

.. container:: user-story

   :Story:
     I as an admin can edit system settings in a structured, step-based layout consistent with first-time setup, including mail and registration dependencies.

   :Acceptance:
     In the Settings area, I see grouped, user-facing labels and subsections aligned with the setup flow. Mail-dependent options are shown consistently with the mail service state. A test mail action is available to validate mail configuration. When I change mail settings and click "Save Settings", the new values are applied immediately without requiring a backend restart.

-----

Admin Logs
----------

.. container:: user-story

   :Story:
     As an admin user, I can see the server logs in the frontend.
   :Acceptance:
     As an admin, I can see the Logs component in the navigation sidebar. When I access this, I can see the list of logs with meta information including timestamps.

-----

User Statistics
---------------

.. container:: user-story

   :Story:
     I as an admin user can view the users and user behavior statistics in the frontend.
   :Acceptance:
     As an admin user, I can see the User Statistics component in the navigation sidebar. When accessing the component I can see a list of all registered users. For each user, I can view the last login time. When selecting a user another panel shows me the list of behavior logs. I can export all behavior logs of all users via a button click. All user behavior statistics can be downloaded as CSV or JSON.

-----

Submissions Import via Moodle
-----------------------------

.. container:: user-story

   :Story:
     I as an admin can import assignment submissions via the Moodle API into CARE and assign a group id to the submissions when importing.

   :Acceptance:
     As an admin, I can access the Submissions Import component in the frontend. There I can test the Moodle API credentials and fetch assignment submissions from a selected Moodle assignment. During import, I can provide a group id that gets assigned to all imported submissions.
Manage Workflows
-----------------

.. container:: user-story

   :Story:
     As an **Admin**, I want to create and manage study workflows, so that I can define the
     sequence of steps participants follow during a study.

   :Acceptance:
     - From the admin area, I can view all available workflows in a list.
     - I can create a new workflow, rename it, and delete it.
     - Each workflow has a visual graph showing its steps and their connections.
     - I can add, edit, copy, and delete individual workflow steps (types: Annotator, Editor,
       Modal).
     - I can import a workflow from a file and export a workflow to a file for reuse across
       instances.
     - New versions of a workflow can be created while keeping the original intact.

-----

First-Time Setup Wizard
------------------------

.. container:: user-story

   :Story:
     As an **Admin**, I want to complete a guided setup wizard on first installation, so
     that the platform is configured correctly before opening it to users.

   :Acceptance:
     - On first login after installation, a setup wizard is presented.
     - The wizard guides me through the essential configuration steps: general settings,
       mail service, user registration options, and optional Moodle integration.
     - Each step validates the inputs before proceeding to the next.
     - A summary step shows all chosen settings before they are saved.
     - After completing the wizard, the platform is ready for use with the configured
       settings applied.

-----

Manage Users
-------------

.. container:: user-story

   :Story:
     As an **Admin**, I want to manage user accounts, so that I can create, edit, and
     deactivate users on the platform.

   :Acceptance:
     - From the admin area, I can view a list of all users.
     - I can create a new user by providing a username, email, and password.
     - I can edit a user's details including their role assignments.
     - I can reset a user's password.
     - I can deactivate or delete a user account.

     **Negative cases:**

     - When I try to create a user with an already-registered username or email, I see an
       error.

-----

Manage Role Rights
-------------------

.. container:: user-story

   :Story:
     As an **Admin**, I want to assign and revoke rights for user roles, so that I can
     control what each role is permitted to do on the platform.

   :Acceptance:
     - From the admin area, I can view the rights assigned to each role.
     - I can assign additional rights to a role or revoke existing ones.
     - Changes take effect immediately for all users with that role.

-----

Manage User Settings
---------------------

.. container:: user-story

   :Story:
     As an **Admin**, I want to configure per-user settings for one or more users at once,
     so that I can override global defaults for specific participants.

   :Acceptance:
     - From the admin area, I can open the **Change User Settings** dialog.
     - I select a setting key and value, then select one or more users to apply it to.
     - A confirmation step shows a summary before applying.
     - After confirming, the setting is updated for all selected users without changing the
       global default.

-----

Bulk Import Users
------------------

.. container:: user-story

   :Story:
     As an **Admin**, I want to import multiple users at once from a file, so that I can
     set up the platform quickly for a large group.

   :Acceptance:
     - From the admin area, I can upload a file containing user data for bulk import.
     - Imported users are created with the specified details and roles.
     - A summary is shown after import indicating how many users were created and whether
       any entries failed.

     **Negative cases:**

     - When the file format is invalid, I see an error and no users are imported.
     - When an entry in the file conflicts with an existing user, that entry is skipped and
       reported in the summary.

-----

Manage Settings
----------------

.. container:: user-story

   :Story:
     As an **Admin**, I want to manage platform settings, so that I can configure the
     behaviour and available features of the platform.

   :Acceptance:
     - From the admin area, I can view and edit all platform settings.
     - Changes are highlighted until I explicitly save them.
     - Only after clicking save are the changes written to the database and applied.

-----

View System Logs
-----------------

.. container:: user-story

   :Story:
     As an **Admin**, I want to view system logs, so that I can monitor platform activity
     and diagnose issues.

   :Acceptance:
     - From the admin area, I can view a list of system log entries.
     - Log entries show the timestamp, severity, and message.
     - I can filter logs by severity or search by keyword.

-----

Manage Configurations
----------------------

.. container:: user-story

   :Story:
     As an **Admin**, I want to manage assessment and validation configurations, so that
     they can be selected when setting up study steps or submission assignments.

   :Acceptance:
     - From the admin area, I can create, edit, and delete assessment configurations
       (type 0) and validation configurations (type 1).
     - Configurations are immediately available for selection in study steps and submission
       assignments after creation.

-----

Replace Document File from Admin Tools
--------------------------------------

.. container:: user-story

   :Story:
     As an **Admin**, I want to replace the PDF or ZIP file of an existing document from
     Admin Tools, so that I can correct a wrong submission file without creating a new
     document or breaking existing links that use the same document id and hash.

   :Acceptance:
     - From Settings → Admin Tools, I can open the replace-document-file tool.
     - I can filter and search documents, select one PDF or ZIP document, and upload a
       replacement file of the same type.
     - After a successful replace, the document keeps the same id and hash; only the file
       bytes on disk change.
     - When I replace a PDF, existing CARE annotations and comments on that document are
       removed.

     **Negative cases:**

     - When I am not an admin, I cannot use Admin Tools or the replace socket.
     - When the uploaded file extension does not match the selected document type, the
       replace is rejected and the stored file is unchanged.
     - When the selected document is not a PDF or ZIP, the tool does not allow replace.

-----

Export User Statistics
-----------------------

.. container:: user-story

   :Story:
     As an **Admin**, I want to export user behaviour statistics, so that I can analyse
     platform usage patterns.

   :Settings:
     ``app.register.requestStats``

   :Acceptance:
     - From the admin area, I can export behaviour statistics for users who have opted in
       to tracking.
     - The export is available as CSV or JSON.

-----

View Criterion Details in Assessment
--------------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to view detailed information about an assessment criterion,
     so that I can understand the scoring rules before assigning a grade.

   :Acceptance:
     - Each criterion in the assessment sidebar has an info icon.
     - Clicking the icon opens a popup showing the criterion's description and a breakdown
       of what each point level represents.

-----

Switch Between Assessment and Comments Sidebar
-----------------------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to switch between the Assessment and Comments tabs in the
     sidebar without losing my entered data, so that I can annotate and assess the document
     in the same session.

   :Acceptance:
     - When I create a new annotation while the Assessment tab is active, the sidebar
       automatically switches to the Comments tab.
     - When I switch back to the Assessment tab, all previously entered grades and comments
       are still present.

-----

NLP-Assisted Assessment
------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want NLP-generated suggestions to be prefilled in my
     assessment, so that I have a starting point for grading that I can review and adjust.

   :Settings:
     ``service.nlp.enabled``

   :Acceptance:
     - When a study step is configured with an NLP skill for assessment, suggestions for
       grades and justifications are automatically generated when the session starts.
     - While the NLP request is processing, a loading indicator is shown.
     - Once results are available, the assessment fields are prefilled with the suggestions.
     - I can review, edit, or accept each suggestion before submitting.

     **Negative cases:**

     - When the NLP request fails, I can either retry the request or skip it, leaving the
       assessment fields empty.

-----

Switch Between Workflow Steps
------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to navigate between workflow steps during a study session,
     so that I can review or correct previous steps before submitting.

   :Acceptance:
     - I can move forward and backward between workflow steps using navigation controls in
       the top bar, but only for steps that are configured to allow it.
     - All entered data (annotations, comments, assessment inputs) is preserved when
       switching steps.
     - When a step requires completion before continuing, the forward navigation is blocked
       until the condition is met.

-----

NLP-Generated Review After Assessment
---------------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want an NLP skill to automatically generate a written review
     based on my completed assessment and annotations, so that I have a draft text to work
     from in the next workflow step.

   :Settings:
     ``service.nlp.enabled``

   :Acceptance:
     - When I complete a workflow step that triggers an NLP review generation, a modal
       appears with a progress indicator while the review is being generated.
     - Once generated, the review text is automatically inserted into the editor step that
       follows.
     - Generation happens only once per session — if I edit or delete the generated text,
       it is not regenerated.
     - I can freely edit the inserted text.

     **Negative cases:**

     - When the NLP request fails, I can either retry the request or skip it, leaving the
       text field empty.

-----

View Study Sessions as Coordinator
------------------------------------

.. container:: user-story

   :Story:
     As a **Coordinator**, I want to open any study session in read-only mode, so that I
     can review participant progress and results without modifying their work.

   :Acceptance:
     - From the study sessions overview, I can open any session in read-only mode.
     - I can view highlights, comments, and assessment inputs as the participant left them.
     - All editing options are disabled.
     - If I have the right to view private user information, participant real names are
       shown in the session table; otherwise they are not visible.

-----

Create and Manage Study Templates
-----------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to create and manage study templates, so that I can reuse
     preconfigured study setups when creating new studies.

   :Acceptance:
     - From the studies section, I can open a template overview and create a new template
       using the same configuration interface as for a regular study.
     - For annotator and editor steps, I can select placeholder documents instead of real
       ones.
     - I can edit or delete existing templates.
     - I can publish a template, making it available for other users to copy and use as a
       starting point.
     - When creating a new study, I can select a saved template as the starting
       configuration.
     - I can export a template to a file and import a template from a file to share
       configurations across instances.

-----

Sync and Detach Study Templates
---------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to sync a template with its source or detach it to make
     it independent, so that I can either keep it up to date with the original or customise
     it freely.

   :Acceptance:
     - When a template is linked to a source template, I can sync it to apply the latest
       changes from the source.
     - I can detach a linked template to make it independent, after which changes to the
       source no longer affect it.

-----

Grade a Study Session
----------------------

.. container:: user-story

   :Story:
     As a **Coordinator**, I want to create a grading assignment from a completed study
     session, so that reviewers can evaluate participant work using a separate grading
     workflow.

   :Acceptance:
     - From the study sessions overview, I can create a new assignment based on an existing
       completed session.
     - The source session content is presented in the components defined as read-only by the
       workflow definition, indicated by a visible read-only watermark.
     - Reviewers can add their own content (annotations, comments, assessment inputs) only in
       the workflow steps and components that are not marked as read-only.
     - Whether all historical annotations or only the current session's annotations are
       visible is controlled by the workflow step configuration.

-----

Preprocess Submissions with an NLP Skill
-----------------------------------------

.. container:: user-story

   :Story:
     As an **Admin**, I want to preprocess submissions with an NLP skill, so that model
     results are ready before a study session starts.

   :Settings:
     ``service.nlp.enabled``

   :Acceptance:
     - From the submissions section, I can select one or more submissions and choose an NLP
       skill to apply.
     - The preprocessing runs in the background and the status of each submission
       (preprocessing, completed, failed) is visible in the table.
     - Only one preprocessing task can be active at a time; I can cancel it at any moment.
     - Successfully preprocessed submissions indicate that data is available for use in
       studies.

     **Negative cases:**

     - When preprocessing fails for a submission, it is marked as failed and the others
       continue.

-----

NLP
~~~

-----

Live NLP Support in the Annotator
-----------------------------------

.. container:: user-story

   :Story:
     As a **Participant**, I want to use NLP support while annotating a document, so that
     I can get automatic sentiment analysis on comments and summaries for highlighted text.

   :Settings:
     ``annotator.nlp.activated``, ``annotator.nlp.sentiment_analysis.activated``,
     ``annotator.nlp.summarization.activated``

   :Acceptance:
     - In the annotator, I can see whether NLP models are connected and toggle NLP support
       on or off.
     - When NLP is active and I submit a comment, it is automatically evaluated by a
       sentiment model and the result is shown next to the comment.
     - For annotations of sufficient length, I can request a summary from an NLP model and
       the result is shown in the sidebar.

-----

View NLP Skills
----------------

.. container:: user-story

   :Story:
     As an **Admin**, I want to view the available NLP skills and their status, so that I
     can monitor which models are connected and ready for use.

   :Settings:
     ``service.nlp.enabled``

   :Acceptance:
     - From the admin area, I can see a list of all connected NLP skills with the number of
       nodes supporting each.
     - I can click on a skill to view its detailed configuration.
     - The status of the NLP broker is clearly indicated; if endpoints are offline this is
       shown.

-----

Debug NLP Skills
-----------------

.. container:: user-story

   :Story:
     As an **Admin**, I want to send test messages to NLP skills and view their responses,
     so that I can verify and debug model behaviour directly from the platform.

   :Settings:
     ``service.nlp.enabled``

   :Acceptance:
     - From the NLP admin view, I can select a skill and send a test message to it.
     - The response is shown immediately and a history of test messages and responses is
       visible.
     - I can view and download the configuration of each skill.

-----

.. raw:: html

   <style>
   .user-story dl.field-list {
     display: grid;
     grid-template-columns: 22ch 1fr;
     border: 1px solid #ddd;
     border-radius: 6px;
     overflow: hidden;
     margin-bottom: 1em;
   }
   .user-story dl.field-list > dt,
   .user-story dl.field-list > dd {
     margin: 0;
     padding: 0.6rem 0.8rem;
     border-bottom: 1px solid #eee;
   }
   .user-story dl.field-list > dt {
     background: #f7f7f9;
     font-weight: 600;
     border-right: 1px solid #eee;
   }
   .user-story dl.field-list > dd {
     white-space: normal !important;
     word-break: break-word;
   }
   .user-story dl.field-list > dt:last-of-type,
   .user-story dl.field-list > dd:last-of-type {
     border-bottom: none;
   }
   @media (max-width: 640px) {
     .user-story dl.field-list {
       grid-template-columns: 1fr;
     }
     .user-story dl.field-list > dt {
       border-right: none;
       border-bottom: 1px solid #eee;
     }
   }
   </style>

