User Stories
============

Here you will find a list of the user stories to test the platform and developments, especially for deploying a new version.

Landing and Authentication
~~~~~~~~~~~~~~~~~~~~~~~~~~

-----

Landing Page
------------

.. container:: user-story

   :Description:
     I as a user, open the webpage localhost:3000 and see a landing page.
     The landing page includes a login/registration and pointers to the documentation.

   :Acceptance:
     I access URL a page loads and some component loads and I can see an option
     to login/register/access documentation.

-----

Guest Login
-----------

.. container:: user-story

   :Description:
     I as a user, open the webpage and can login as a guest to have basic user functionalities available.
   :Acceptance:
     There is a "Login as guest" button on the login page. When I click on the button I am logged in as a guest user with all their rights and their specific view of the app.

-----

Registration
------------

.. container:: user-story

   :Description:
     I as a user, find a registration button on the login/landing page and can register as an individual user of the service specifying my credentials. I get feedback when my inputs are invalid.
   :Acceptance:
     There is a registration button on the login/landing page. When I click on the login button I see a form, where I enter my first name, last name, email, user name, password etc. During entering of my information, I get feedback whether my inputs are valid (e.g. valid email format, password criterias). I am able to open/read/accept the consent and optional the behaviour logging. Upon clicking register, a user account is created in the database. I get a response, if registration was successful or unsuccessful.

-----

User Login
----------

.. container:: user-story

   :Description:
     I as a user, find a login button on the login/landing page. When I enter my username or email address and my password, I am logged in. I can see the webpage from my individual user's perspective.
   :Acceptance:
     There is a login button on the login/landing page. I see a form where I can enter my credentials, either username or email with a password. When I click login, I get feedback that I am logged in. In case I use wrong credentials, I get a negative response and am not logged in. I am forwarded to my individual user dashboard. I now see the option to logout. When I click on logout, I am redirected to the login/landing page and am not logged in anymore.

-----

Consent and Terms
-----------------

.. container:: user-story

   :Description:
     I as a user can review and accept the platform terms, optionally enabling behavior statistics and data sharing.

   :Acceptance:
     On first login or when required, a modal shows the terms with checkboxes for optional tracking and data sharing. Accepting stores my preferences and grants access to the app. Declining logs me out and returns me to the login page. I can later update my consent via the model.

Dashboard
~~~~~~~~~

-----

PDF Documents
-------------

.. container:: user-story

   :Description:
     I as a user, when logged in, see my individual dashboard including a view of my created documents, can upload new papers and delete existing papers and visit each paper.
   :Acceptance:
     There is a of documents visible in the dashboard. It shows the most important meta information including a title and creation timestamp. If there are no documents, the absence of documents is indicated by a message. For each document, I can press on a button to visit this specific document. For each document, I can press a button to delete it from the of documents. When I press on the upload button, I can select a file from disc, it is added to the with the respective filename and I can access it via the respective button. I can upload any type of textual PDF up to a roughly 50 pages and with many figures.

-----

HTML Documents
--------------

.. container:: user-story

   :Description:
     I as a user can create an HTML document within the application. I can edit this document using an editor component. My changes persist and are visible when I revisit the application. I can also download the HTML document as a .html file to my local device.
   :Acceptance:
     I can create a new HTML document through a UI action. I can make edits using an HTML editor component. My edits persist across sessions. I can download the document as a .html file. When I revisit the document later, it reflects the last saved version.

-----

Document Upload
---------------

.. container:: user-story

   :Description:
     I as a user want to have feedback on the success of uploading a new document.
   :Acceptance:
     In the dashboard, I can clearly see if the PDF was successfully uploaded to the server. I receive a clear message if this failed and a clear message if this was successful. Uploading multiple different documents pushes multiple different documents to the server.

-----

Renaming documents
------------------

.. container:: user-story

   :Description:
     I as a regular user can change a document's name in the dashboard component.
   :Acceptance:
     As a regular user, I see a button to edit the name of a document in the document for each entry. When I click on this button I am prompted to add a new name. This change takes effect immediately and is stored on the server.

-----

Export Project Data
-------------------
.. container:: user-story

   :Description:
     I as a user can export data from any project listed in the “Projects” Dashboard. By clicking on “Export Data” in a specific project row, I can choose between different export types and download the corresponding data after confirming my selection.
   :Acceptance:
     As a user, I can navigate to the “Projects” section in the Dashboard, where I see a table listing all available projects. In each project row, there is an “Export Data” button. When I click on this button, a modal opens allowing me to select an export type from a predefined list (e.g., document data, study data, or assignment results). After choosing an export type, I confirm my selection, and the system generates the export in the appropriate format (e.g., CSV or JSON). A download link or button appears once the export is completed, enabling me to download the data file to my local device.

-----
Annotator
~~~~~~~~~

-----

PDF Viewer
----------

.. container:: user-story

   :Description:
     I as a user can visit the URL of a specific PDF document. I see the PDF document in a standard PDF viewer and the sidebar is present.
   :Acceptance:
     For a given document by URL, the PDF loads as I uploaded it. It is shown in the PDF reader and rendered properly. I can select texts in the PDF (if it had text in the first place). The basic PDF functionalities are available. Loading takes no more than 1s or so, depending on the size. I see a progress bar during loading, if it should take longer.

-----

Color Coding
------------

.. container:: user-story

   :Description:
     I as a reviewer want to select different predefined tags for my annotations
   :Acceptance:
     In the annotator view, I can select a span of text and now select from a range of color-coded categories to assign to my highlight and annotations. After selecting a category, the annotation with the associated tag shows up in the sidebar. The highlight color matches the tag color.

-----

Sidebar
-------

.. container:: user-story

   :Description:
     I as a user can visit the URL of a specific document, where next to the PDF I can see the sidebar on the right. It opens and it shows all annotations on that page.
   :Acceptance:
     For a given document page, the sidebar is loaded next to the PDF document. The sidebar is open. If I created any annotations on this document beforehand, I can see them again. They are ordered by occurrence in the PDF. I see all tags and comments previously created. I can toggle the sidebar between show and hide.

-----

Creating annotations
--------------------

.. container:: user-story

   :Description:
     I as a user in the annotator view, can select a span of text in the PDF and store an annotation persistently.
   :Acceptance:
     For a loaded annotator view, I can scroll through the PDF and select any text of reasonable length. The text is highlighted while doing so and a tag selection field pops up. Clicking on one of the buttons creates the annotation in the sidebar. My view scrolls automatically to this new annotation in the sidebar. If my selection was erroneous I see an error and the annotation is not created. In the sidebar I can add a comment and tags. After submitting the annotation it is stored persistently. If I abort the creation, it is discarded and not stored. If I do not interact with the sidecard, it is stored by default.

-----

Modifying annotations
---------------------

.. container:: user-story

   :Description:
     I as a user in the annotator view, can change any annotation in the sidebar.
   :Acceptance:
     For a loaded annotator view, I can scroll through the sidebar and click on a delete and edit button for any annotation. Pressing delete discards the annotation and it is removed (together with its highlight) from the sidebar and the database. When pressing "edit", I can change the comments and tags of that annotation. Saving these changes stores them persistently.

-----

Annotation Navigation
---------------------

.. container:: user-story

   :Description:
     I as a user in the annotator view, can navigate through annotations and highlights dynamically.
   :Acceptance:
     For a loaded annotator view, I can click on any annotation in the sidebar and the PDF view automatically scrolls to the right highlight. The highlight of the selected annotation becomes visually clear. When clicking on a highlight, the sidebar scrolls to the respective annotation in the sidebar.

-----

Document Note
-------------

.. container:: user-story

   :Description:
     I as a reviewer want to have the option to leave comments that are not anchored in the text.
   :Acceptance:
     In the annotator view, I see a button to add a document note. When I click this button a new comment is added to the sidebar. I can add tags and text to it and submit it as for regular annotations. The document note is not anchored in text and it becomes clear that this note is different from the other annotations.

-----

Comment Replying
----------------

.. container:: user-story

   :Description:
     I as a regular user can reply to my or other user's comments.
   :Acceptance:
     As a regular user, I can press a reply button on a comment in the sidebar. This creates a new comment in a reply thread and opens the thread to open information. When submitting the reply it becomes visible (in real time) to all users. I can reply to replies creating whole reply trees.

-----

Annotator Collaboration
-----------------------

.. container:: user-story

   :Description:
     I as a regular user can collaborate with other users on a document and see their comments and highlights and edits in close to real time.
   :Acceptance:
     As a regular user, I can access publish a document and share the link with other users. When we access the document in parallel and created highlights and comments in parallel, the changes are pushed to everyone that is accessing this document at the moment. Editing an existing comment shows an indication that the comment is currently edited.

-----


Configure Assessment in Study Creation
---------------------------------------
.. container:: user-story

    :Description:
      I as a user can configure an Assessment component in a study workflow by selecting a predefined assessment configuration and optionally enforcing completion before the workflow can continue.
  
    :Acceptance:
      As a user creating a new study with a selected workflow integrating the Assessment module in one of the steps, an icon appears to configure that step. In that modal I can select from the list of available assessment configurations defined in the Admin Dashboard. In the same modal, there is a checkbox labeled “Require full assessment completion before continuing.” When this checkbox is activated, the workflow enforces that every criterion in the selected assessment must be graded and justified before the next step can start. If any criterion remains unfilled, a message is shown indicating which elements are incomplete. When I save the workflow, the selected configuration and completion requirement are stored as part of the study definition. During study execution, this enforcement is reflected in the annotator view, preventing progress until the assessment is fully completed.

-----

NLP Skill Integration for Assessment
------------------------------------
.. container:: user-story

   :Description:
     I as a user can integrate NLP Skills into the Assessment component during study configuration, allowing model-generated suggestions to prefill assessment fields.
   :Acceptance:
     As a user in the study creation modal, when adding assessment configuration, I can enable NLP Skill integration. A dropdown allows me to select one or multiple NLP Skills registered in the system. When enabled, these skills can automatically generate prefilled suggestions for assessment fields, such as predicted grades or justification text. These suggestions are shown in the assessment interface as “model suggestions.” The user can review, edit, or accept each suggestion. If the “Require full completion before continuing” option is active, all NLP-generated content must still be manually confirmed or edited before the workflow can proceed. When a session starts, the NLP request is sent or preprocessed data is used. Until the NLP results are calculated, an information is displayed.

-----

Sidebar Switching Between Assessment and Comments
--------------------------------------------------
.. container:: user-story
  
   :Description:
     I as a user can continue annotating a PDF while using the Assessment sidebar. When I create a new highlight, the sidebar automatically switches back to the Comment view without losing any entered assessment data.
   :Acceptance:
     As a user performing an assessment in the annotator view, I see the Assessment sidebar open on the right side. If I select a text span in the PDF to create a new annotation, the sidebar automatically switches to the Comments tab, where I can add a comment or tag to the highlight. Any data I have already entered in the Assessment sidebar remains saved, and when I switch back to the Assessment tab, all previously entered grades and justifications are still there. This ensures seamless workflow between assessing and annotating without data loss. Both the comment creation and assessment functionalities operate smoothly in this integrated interface.

-----

Assessment Sidebar Interaction
------------------------------
.. container:: user-story
    :Description:
      I as a user can open the Assessment sidebar during a study or document review and view all defined rubrics and criteria from the selected assessment configuration. I can assign grades and write justifications for each criterion.
    :Acceptance:
      As a user in a study session or annotator that includes an Assessment component, I can open the Assessment sidebar by click on the tab at the top of the sidebar. The sidebar displays a list of all rubrics and their respective criteria as defined in the selected assessment configuration. Each criterion shows its name, description, and grading scale (based on minPoints and maxPoints defined in the JSON). For every criterion, I can select a grade value within the defined range, using a dropdown. There is a text area where I can enter a justification explaining my choice. All my inputs are saved when I click on the save button and persist between sidebar switches, tab changes, or browser reloads. Once all required criteria are graded, the completion status of the assessment step is marked as “completed,” allowing me to proceed to the next workflow step if enforcement is enabled and the final result of the assessment is also shown.

-----

Criterion Information Popup
---------------------------
.. container:: user-story

   :Description:
     I as a user can view detailed information about each criterion in the assessment by opening an information window that explains its scoring rules and descriptions.
   :Acceptance:
     As a user in the Assessment sidebar, each criterion includes an information icon. When I click this icon, an information modal or tooltip opens, displaying the criterion’s description and a breakdown of what each point level represents (e.g., what qualifies for 0, 1, or maximum points). The popup also includes contextual text from the JSON configuration, helping me understand the grading standard. This functionality works consistently across all criteria and ensures that users can assess documents accurately according to the configured rubrics.

-----

Comment Voting
---------------
.. container:: user-story

   :Description:
     I as a user can upvote or downvote comments in the annotator sidebar to indicate their helpfulness. The voting system works for all comments in document and study session annotators, following the configuration of whether voting or only-upvote mode is enabled.

   :Acceptance:
     As a user, when I open a document or study session in the annotator view, I can see the comments listed in the right sidebar. Each comment displays voting controls: an upvote and a downvote button, unless the system is configured for only-upvote mode. In that case, the downvote button is hidden. Only comments from another user can be voted. When I click on the upvote or downvote button, my vote is registered immediately, and the badge showing the number of helpful (up) votes updates in real time. If I click the same button again, my vote toggles off, reverting to its previous state. The upvote badge shows the total count of helpful votes, and the interface clearly indicates which button I have currently selected. Voting works consistently across both standard document annotation views and study session annotator views.

-----

Mark Annotation as Completed (Hide Annotation)
----------------------------------------------
.. container:: user-story

   :Description:
     I as a user can mark annotations as completed in the annotator by hiding them from view. This allows me to keep my workspace organized by collapsing finished or resolved annotations. The completion state is user-specific and persists across sessions and page reloads.

   :Acceptance:
     As a user in the annotator view (either for a regular document or a study session), I can see a checkbox labeled “Completed” (or an equivalent icon toggle) on each annotation card in the right sidebar. When I check this box, the annotation is marked as completed. The corresponding highlight in the PDF viewer immediately becomes hidden, and the annotation card collapses or becomes visually faded to indicate that it is completed. An icon on the annotation card clearly shows the completed status, such as a checkmark or similar indicator. The completion state is stored individually for each user, meaning that marking an annotation as completed affects only my view, not that of other collaborators. When I reload the page or revisit the annotator later, the completion settings are restored exactly as I left them. If I uncheck the “Completed” box, the annotation and its highlight reappear immediately.

-----

Creating Annotations
--------------------
.. container:: user-story

   :Description:
     I as a user in the annotator view, can select a span of text in the PDF and store an annotation persistently.
   :Acceptance:
     For a loaded annotator view, I can scroll through the PDF and select any text of reasonable length. The text is highlighted while doing so and a tag selection field pops up. Clicking on one of the buttons creates the annotation in the sidebar. My view scrolls automatically to this new annotation in the sidebar. If my selection was erroneous I see an error and the annotation is not created. In the sidebar I can add a comment and tags. After submitting the annotation it is stored persistently. If I abort the creation, it is discarded and not stored. If I do not interact with the sidecard, it is stored by default.

-----

Modifying Annotations
---------------------
.. container:: user-story

   :Description:
     I as a user in the annotator view, can change any annotation in the sidebar.

   :Acceptance:
     For a loaded annotator view, I can scroll through the sidebar and click on a delete and edit button for any annotation. Pressing delete discards the annotation and it is removed (together with its highlight) from the sidebar and the database. When pressing "edit", I can change the comments and tags of that annotation. Saving these changes stores them persistently.

-----

Study Participation
~~~~~~~~~~~~~~~~~~~

-----

Study View
----------

.. container:: user-story

   :Description:
     I as a regular user want to be able to access a document, start and participate in a study
   :Acceptance:
     After receiving an invitation link to a study, I can access a paper via this link, where I have the option to join the study, or (if applicable) resume a previous session. In the annotator view, I can make my regular annotations. There is an easily visible review submission button. After confirming my decision to submit, I am lead back to the document overview showing me now a completed review. The study can also be accessed by any other regular user via the link.

-----

Study Coordinator
-----------------

.. container:: user-story

   :Description:
     I as a study coordinator want to be able to create an annotation study on top of a document, where users can join and realize their annotations in a controlled setting.
   :Acceptance:
     As a regular user, I see the Study component in the navigation sidebar. Here I see a list of all ongoing studies and create new ones. I can also create a new study in the Documents component of the dashboard for a specific document. When creating a study I can configure the study title, description, collaboration settings and timings. After starting a study I can share a link with the participants, which I can copy from the, and users can access this study.

-----

Study Session View
------------------

.. container:: user-story

   :Description:
     I as a study participant want to be able to see all ongoing study sessions to pick them up again at a later point in time.
   :Acceptance:
     As a regular user, I see the Study Session component in the navigation sidebar, where I find a list of all study sessions I have started and finished, separated with clear titles. For each session, I can view its meta-information, and get live updates on the status of the session. I can access a session to resume it if it is resumable, or open it in read-only mode if it is already closed. When permitted, I can delete a study session; once deleted or after finishing a session, it no longer appears in my list. All interactions and status changes update instantly, keeping my view organized and current.

-----

Close Study
-----------

.. container:: user-story

   :Description:
     I as a user can close a study, marking it as inactive. This prevents new study sessions from being created. Any active study sessions are automatically closed.
   :Acceptance:
     I can trigger a close action on a study. The study is marked as inactive. New sessions cannot be created under the closed study. Existing active sessions are terminated or marked as closed. The UI indicates that the study is now closed.

-----

Time Limit Crossed for Study Session
------------------------------------

.. container:: user-story

   :Description:
     I as a user am notified when the time limit for a study session is exceeded. The session is automatically marked as expired, and I can no longer continue but only review or finish it.
   :Acceptance:
     Each study session with a time limit: When this limit is exceeded, the session is marked expired. A message is shown stating that the time has expired. The interface reflects this state and restricts further editing or annotation.

-----

Limit Study Sessions
--------------------

.. container:: user-story

   :Description:
     I as a study creator can define the total number of allowed sessions for a study and also limit how many sessions each individual user can create. Once limits are reached, session creation is blocked and a message is shown.
   :Acceptance:
     As a study creator, I can set a maximum number of sessions for the study and per user. The system enforces these limits. If exceeded, users are shown an informative message and prevented from creating additional sessions. The UI reflects that limits have been reached.

-----

Resumable Study Sessions
------------------------
.. container:: user-story

   :Description:
     I as a user can resume a study session after closing or reloading the browser, returning to the exact same state, including the assessment data, comments, and current workflow step.
   :Acceptance:
     As a user participating in a study session that is configured as resumable, I can close the browser or lose the connection without losing my progress. When I reopen the study session later, all my previous data is reloaded: completed or partial assessment grades and justifications, written comments, created highlights, and my position within the study workflow. The system restores which sidebar tab (Comments or Assessment) was last active and ensures that all local changes have been synced and persistently stored. This behavior guarantees that I can continue my review or assessment exactly where I left off without needing to redo prior work.

-----

Close Study
-----------
.. container:: user-story

   :Description:
     I as a user can close a study, marking it as inactive. This prevents new study sessions from being created. Any active study sessions are automatically closed.
   :Acceptance:
     I can trigger a close action on a study. The study is marked as inactive. New sessions cannot be created under the closed study. Existing active sessions are terminated or marked as closed. The UI indicates that the study is now closed.

-----

NLP Skill for Automated Review Generation After Assessment
----------------------------------------------------------
.. container:: user-story

   :Description:
     I as a user can automatically generate a written review based on my completed assessment and inline comments using an NLP Skill. The generated text is inserted into the review section automatically, but only once per session.

   :Acceptance:
     As a user participating in a study that includes a workflow step with an editor configured a NLP skill, once I have completed all grading criteria and added my inline comments, the system automatically triggers the configured NLP Skill (review generation). If one has been set up for this workflow step. When the next step in a study session triggers the skill, a modal appears with a progress indicator and motivational waiting messages (e.g., “Creating your review...”, “Almost there...”, “This will only take a moment…”). While the model request is processing, the user cannot make new edits, ensuring data consistency. When the response from the NLP Skill is received, a complete review text is automatically inserted into the review text field or summary section. This generation happens only once per session, if the user edits or removes the generated review, no automatic regeneration occurs. The user can freely edit or refine the inserted text afterward. If the NLP request fails, a message is displayed indicating the issue, and the review text remains empty.

-----

Switch Between Workflow Steps in Study Sessions
-----------------------------------------------
.. container:: user-story

   :Description:
     I as a user can move back and forth between the workflow steps of a study session, as long as the configuration of the workflow allows it. When blocking mechanisms (such as enforced assessment completion) are active, forward navigation is restricted until the required step is completed.

   :Acceptance:
     As a user participating in a study session, I can navigate between workflow steps using navigation controls (e.g., “Previous” and “Next” buttons) displayed in the top bar of the study interface. This navigation feature is enabled when the study creator has allowed switching back in workflow steps. If a blocking mechanism is defined, for example, when a specific step such as the Assessment requires full completion before continuing, the “Next” button is disabled until all mandatory fields are filled in and the step is validated as complete. Once the blocking condition is resolved, I can freely move forward or backward between workflow steps. When switching steps, all entered data (including annotations, comments, assessments, and other inputs) remains saved and persistent. The system ensures that the interface restores exactly the same view as last left, no automatic scrolling or repositioning occurs when returning to a previous step.

-----

View Study Sessions (Read-Only Mode)
------------------------------------

.. container:: user-story

   :Description:
     I as a user with the teacher role can access all study sessions in a read-only mode, allowing me to review participant progress and results without being able to modify the content.

   :Acceptance:
     As a user with the role teacher, I can open any study from the “Studies” section in the Dashboard of the published project. In the study overview, I see a button labeled “Study Sessions.” When I access this section, a table lists all sessions that have been created for this study, including meta-information. When I select a session, it opens in a read-only view. In this mode, I can scroll through the document, see highlights, comments, and assessment inputs, but all editing options (adding, modifying, or deleting) are disabled. This allows me to review the participant’s work exactly as they submitted it while maintaining data integrity.

-----

Display Real Names
------------------

.. container:: user-story

   :Description:
     I as a study creator with the role Teacher can see the real names of users participating in the study sessions, while regular users only see anonymized identifiers.

   :Acceptance:
     As a teacher with access rights to a study, when I open the study’s “Study Sessions” table, I can see the participants listed with their real names (first name, last name). If I am not a teacher or lack the necessary permissions, the columns are not displayed and in the network protocol not transmitted. This visibility is role-based, only users with the Teacher role and explicit access to the study can see real participant information. The interface clearly differentiates user roles and ensures that privacy rules are followed.

Admin Features
~~~~~~~~~~~~~~

-----

Admin View
----------

.. container:: user-story

   :Description:
     I as an admin have an admin dashboard in addition to my regular user dashboard.
   :Acceptance:
     In the dashboard, I see the additional navigation components on the sidebar that are only visible to admins. Clicking on them leads me to these components and allows to render their contents.

-----

Admin Settings
--------------

.. container:: user-story

   :Description:
     I as an admin user want to access and modify the settings of the system in the frontend.
   :Acceptance:
     As an admin, I can see the Settings componentn in the navigation sidebar. When I access this, I can see the list of settings, reload them from the server backend, make changes and save these on the server. The changes have immediate effect on the behavior of the application.

-----

Admin Logs
----------

.. container:: user-story

   :Description:
     As an admin user, I can see the server logs in the frontend.
   :Acceptance:
     As an admin, I can see the Logs component in the navigation sidebar. When I access this, I can see the list of logs with meta information uncluding timestamps.

-----

User Statistics
---------------

.. container:: user-story

   :Description:
     I as an admin user can view the users and user behavior statistics in the frontend.
   :Acceptance:
     As an admin user, I can see the User Statistics component in the navigation sidebar. When accessing the component I can see a list of all registered users. For each user, I can view the last login time. When selecting a user another shows me the list of behavior logs. I can export all behavior logs of all users via a button click. All user behaviour statistics can be downloaded as csv or json.

-----

Submissions Import via Moodle
-----------------------------

.. container:: user-story

   :Description:
     I as an admin can import assignment submissions via the Moodle API into CARE and assign a group id to the submissions when importing.

   :Acceptance:
     In the Submissions module, I see an option "Import via Moodle". When I select it, I can enter the API URL, API key, course ID, and assignment ID. I can also select a validation file that defines the validation rules. When I start the import, submissions are fetched from Moodle and validated against the rules. Only submissions that pass validation are imported into CARE, each being assigned a groupId based on the import configuration. At the end of the process, I can download a CSV file containing all failed or invalid submissions. After successful import, all valid submissions appear in the Submissions table and are ready for further processing.

-----

Import Student Accounts from Moodle
-----------------------------------
.. container:: user-story

   :Description:
     I as an admin can import a selection of user accounts from a specific Moodle course into CARE. Usernames and passwords are generated randomly. After importing, I can either send the credentials directly to the Moodle users via the Moodle API or download them as a CSV file for later sharing through CARE.

   :Acceptance:
     As an admin, I can access the "Import Users via Moodle" in the Admin Dashboard "Users" to import users from Moodle. When selecting this option, a stepper modal opens guiding me through the process. In step 1, I enter my Moodle credentials and course ID to connect to the Moodle API. In step 2, I see a list of all users from the specified Moodle course and can select which users to import. The system allows to filter out duplicates and marks already existing CARE users. In step 3, I am shown an overview of the selected users and can confirm the import. In step 4, the process completes and I receive a summary showing which users were successfully imported and which failed, including possible error messages. For each newly imported user, a unique username and random password are generated automatically. I can choose to send login credentials directly to the corresponding Moodle users via the API or download the credentials as a CSV file. The interface clearly indicates success or failure of each action, and the new users appear in the CARE user database immediately after successful import.

-----

Import Submissions from Moodle
------------------------------
.. container:: user-story

   :Description:
     I as an admin can import uploaded student submissions from Moodle into CARE. The import process is guided through a stepper modal where I connect to Moodle, select submissions, assign a group ID, set a validation file, and finally complete the import with feedback on the results.

   :Acceptance:
     As an admin, I can access the “Import via Moodle” option in the Admin Dashboard under the “Submissions” section. When I click on it, a stepper modal opens to guide me through the import process. In step 1, I enter my Moodle API credentials. In step 2, a list of all available student submissions for the selected Moodle course is displayed. I can select one or multiple submissions to import. In step 3, I can assign a group ID to the selected submissions, allowing me to distinguish between different Moodle assignments after import, and I can also define a validation file to be used to verify the correctness or completeness of each submission. When proceeding to the final step, the import process begins and the system provides detailed feedback on the results. Each submission that passes validation is imported into CARE and linked with the assigned group ID. If validation fails for any submission, it is skipped from import, and clear error messages are displayed indicating the cause of the failure.

-----

Assign a Group and/or Copy Submissions
--------------------------------------
.. container:: user-story

  :Description:
     I as an admin can manually assign a new group ID to one or multiple submissions from the Admin Dashboard. I can also choose to duplicate the selected submissions instead of just updating them, keeping the originals unchanged while assigning the new group ID to the copies.

  :Acceptance:
     As an admin, I can access the “Submissions” section in the Admin Dashboard and click on the “Assign Group” option. A stepper modal opens where I first select one or multiple submissions from the existing list. In the next step, I can enter or select a new group ID that should be applied to the chosen submissions. A visible checkbox allows me to decide whether I want to copy the submissions or only update their existing records. When the copy option is selected, each chosen submission is duplicated completely, including all associated files, while the original submissions remain unchanged. The duplicated submissions receive the newly assigned group ID and are added to the database as separate entities. If the copy option is not selected, the selected submissions are directly updated with the new group ID. After the process completes, a confirmation message is displayed.

-----

Create Study Templates
----------------------
.. container:: user-story

  :Description:
     I as a user can create, view, edit, and delete study templates in the Dashboard under “Studies.” These templates store preconfigured study setups that can later be reused when creating new studies.

  :Acceptance:
     As a user, I can navigate to the “Studies” section in my Dashboard and click on the “Saved Templates” button. A modal opens showing a list of all existing study templates with their basic information. Within this modal, I can click on the “Add” button to create a new study template. When I create a template, the same Study Coordinator interface as for a regular study opens, allowing me to configure all available options including workflow steps, timing, collaboration settings, and metadata. For annotator and HTML documents, I can select placeholder entries instead of real documents. After completing the configuration and confirming the creation, the system saves the setup as a template only. The new template then appears in the overview list, where I can view its configuration, edit its parameters, or delete it entirely. Changes are immediately reflected in the overview.

-----

Bulk Create Study Sessions
--------------------------
.. container:: user-story

  :Description:
     I as an admin can create multiple study sessions at once using a previously defined study template. Through a guided modal, I can select documents or submissions, assign users, and define a distribution strategy for automatically generating and assigning the study sessions.

  :Acceptance:
     As a user, I can open the “Studies” section in the Dashboard and click on the “Add Bulk Assignments” button. A stepper modal opens guiding me through the bulk study session creation process. In the first step, I select one of the previously created study templates as the basis for the new sessions. In the second step, depending on the workflow type defined in the template, I can select either documents or submissions to use as placeholders for the study template. When selecting submissions, I can filter them by group ID to limit the selection. For each chosen document or submission, a separate study will later be created. In step three, I select the users who will participate in these studies, with filtering options for roles and number of documents to be assigned per user. In step four, I define the distribution logic for the bulk creation. I can choose either a role-based selection, where documents or submissions are distributed among users according to their assigned roles and the specified number of reviews per role, or a reviewer-based selection, where documents or submissions are directly distributed among the selected reviewers. In the final step, I see a confirmation overview. When I confirm, the system automatically creates and assigns all study sessions according to the selected distribution method. The assignments are randomized to ensure even distribution, and a completion message is displayed listing successful and failed creations. All newly created studies and sessions become immediately visible in the Studies overview.

-----

Add Single Study Session
------------------------
.. container:: user-story

  :Description:
     I as a user can create a single study session based on an existing study template. Using a guided modal, I can select one document or submission and assign multiple users to create individual sessions within the same study.
  
  :Acceptance:
     As a user, I can open the “Studies” section in the Dashboard and click on the “Add Single Assignment” button. A stepper modal opens guiding me through the process of creating a single study session. In the first step, I select a previously created study template that defines the study configuration and workflow. In the second step, I select exactly one document or one submission to be used for the study. If submissions are available, I can optionally filter them by group ID to simplify selection. In the third step, I select one or multiple users who will participate in the study session. For each selected user a study session will automatically created and assigned to the created study. In the final step, I see a confirmation summary listing the selected template, document or submission, and the assigned users. After confirming, the system creates the new study and corresponding sessions based on the template configuration. A confirmation message indicates the success or failure, and the new study and its sessions appear immediately in the “Studies” overview.

-----

Manual Submission Upload
------------------------
.. container:: user-story

   :Description:
     I as an admin can manually upload a submission files directly into CARE. During the upload process, I can assign the submissions to a specific group, apply validation rules through a selected validation file, and link each submission to an existing user.

   :Acceptance:
     As an admin, I can access the “Submissions” section in the Admin Dashboard, where I see an option “Manual Import.” When I click on this button, a stepper modal opens guiding me through the upload process. In the first step, choose a group ID to which the new submissions will be assigned and I can assign the submission to a specific existing user from a searchable user list. In the Second step I can Assign Group Number and Select JSON Validator. In the third step, I can then upload one or multiple files (based on the selected validation file). After confirming my selections, the system performs a validation check. The uploaded submission immediately appear in the Submissions table.

-----

Assessment and Validation Configurations
----------------------------------------
.. container:: user-story

   :Description:
     I as an admin can manage configuration files for Assessments and Validations in the Admin Dashboard. These configurations are stored as JSON and can be added, updated, or deleted directly from the frontend.

   :Acceptance:
     As an admin, I can navigate to the “Configurations” section in the Admin Dashboard. Here I see a list of all saved configurations displayed in a table with their names, types (Assessment or Validation), creation timestamps, and last update times. I can add a new configuration by clicking “Upload Configuration,” where I upload or paste a JSON file. Once saved, the configuration appears immediately in the list. I can edit an existing configuration by opening it in a modal, where I can update the JSON content or rename it. Deleting a configuration removes it from the list after confirmation. The system validates the JSON structure before saving, and clear feedback messages are shown for success or failure. Updated configurations are instantly available for selection in other modules such as Study Creation or Validation workflows.

-----

Preprocessing NLP Skills on Submissions
---------------------------------------
.. container:: user-story

   :Description:
     I as an admin can start preprocessing submissions with a selected NLP Skill to prepare data for later study or assessment use. The preprocessing process can be tracked, canceled, and resumed, with each submission showing its processing status in the table.

   :Acceptance:
     As an admin, I can open the “Submissions” section in the Admin Dashboard and click the “Apply Skill” button. A stepper modal opens guiding me through the process. In the first step, I select one or multiple submissions from the table. In the second step, I choose the NLP Skill to apply from a dropdown list. In the third step, I confirm and start preprocessing. The modal then displays the ongoing process with meta-information such as start time, progress, and current submission being processed. During this time, a status indicator appears next to each submission showing “Preprocessing,” “Completed,” or “Failed.” Only one preprocessing task can be active at a time, and I can cancel it at any moment. The preprocessing results are saved on the associated document file within each submission, that is defined in the third step of the modal for each unique validation configuration. When I refresh the page, the table still displays the most recent preprocessing status for each submission. Successfully processed submissions show an indication that preprocessed data is available, and the data is available for later assessment use or review automation.

-----

Publish Sessions Links
-----------------------
.. container:: user-story
    :Description:
      I as an admin user want to be able to publish study session links for multiple submissions, either based on studies or users, and distribute them through different channels (Moodle, Email, or CSV) so that the respective users receive the correct session links connected to their submissions.
    :Acceptance:
      As an admin user, I can access the “Public Submissions” button from my admin dashboard "Submissions". When clicking it, a modal opens where I first select a submission for which session links are to be collected, and I can filter the available submissions by group ID. In the next tab, I select the sessions that used the documents of the chosen submission, either based on studies (sending links for each study that used the submission document) or based on users (sending all session links from the sessions a user opened). In the following step, I create the message that will be shared, including placeholders such as the username or session link that will be automatically replaced for each user. I then choose the publishing method between Moodle, Email, or CSV. When selecting Moodle, I need to insert my Moodle credentials and select the corresponding assignment or course where the session information should be uploaded. When selecting Email, the message is sent to the user’s registered email address, and when selecting CSV, I can download a file containing all usernames, user IDs, and session links. In the final confirmation step, I see a summary of all selected options and can confirm or cancel the operation. After confirmation, the system validates the input, executes the chosen publishing method, and provides success or error feedback.

-----

Export Assignment Results
-------------------------
.. container:: user-story
    :Description:
      I as a user can export assignment results from studies that used the “Assignment” component. The results can be downloaded as a CSV file containing user and study information or directly uploaded to Moodle.
    :Acceptance:
      As a user, when selecting “Export Data” for a project, I can choose the export type “Assignment Results". In the next step, the system gathers all results from closed study sessions that include the “Assignment” component. A CSV file is automatically generated containing detailed information from both the submission/document and the corresponding user data. Each row includes the user information related to the submission or document (external user ID, first name, last name, username, roles), as well as the same information for the user who owns the study session. The CSV also includes the associated data values (document_data variables, e.g. all assignment criteria), and direct links to the related study sessions. In the export modal, an additional button “Upload to Moodle” is available. When clicking this button, a secondary modal opens, allowing me to provide Moodle API credentials and select which column from the CSV represents the result to be inserted into Moodle. After confirming, the system automatically uploads the selected results to the corresponding Moodle course. The modal provides feedback on the success or failure of each upload, and the completed export remains available for download as a CSV for reference.

-----

Add Reviewer to Existing Study
------------------------------
.. container:: user-story

   :Description:
     I as a user can add one or multiple reviewers to an existing study directly from its session list. By selecting users in a modal, new sessions are automatically created and linked to the chosen study.

   :Acceptance:
     As a user, I can open the “Studies” section in the Dashboard and navigate to the session list of an existing study. In the session list view, I see an “Add” button that allows me to add additional reviewers. When I click on this button, a modal opens displaying a searchable list of all available users. I can select one or multiple users from this list to be added as reviewers. After confirming my selection, the system automatically creates new sessions for each selected user and assigns them to the current study, inheriting the study’s configuration and settings. A confirmation message is displayed after the creation process, showing how many sessions were successfully created and if any failed. The newly added reviewer sessions immediately appear in the session list of the study, reflecting their assigned users and current session status.

-----

Check Completion of Grading and Reviews
---------------------------------------
.. container:: user-story

   :Description:
     As a course admin, I can check whether all grading and student reviews have been completed.

   :Acceptance:
     A dashboard or table shows completion status (Closed/Running/Ended) for each study and study session. Incomplete items are highlighted.

-----

Admin View
----------

.. container:: user-story

   :Description:
     I as an admin have an admin dashboard in addition to my regular user dashboard.

   :Acceptance:
     In the dashboard, I see the additional navigation components on the sidebar that are only visible to admins. Clicking on them leads me to these components and allows to render their contents.

UI Elements
~~~~~~~~~~~

-----

Topbar
------

.. container:: user-story

   :Description:
     I as a user want to see a topbar in the annotator view that grants me context-dependent functionalities and allows me to return to my dashboard.
   :Acceptance:
     In the annotator/reviewer/editor view, there is a topbar on the page. It remains at the top while scrolling. There is a button to return to the user dashboard. There are potentially more buttons depending on the context of the current view of the document.

-----

Form input validation
---------------------

.. container:: user-story

   :Description:
     I as a regular user get feedback for all inputs on any form of CARE. This includes at least the registration, login, document edit modal, study edit modal and tagset edit modal.
   :Acceptance:
     As a regular user, when I open a form to enter or change information on some data entity (e.g. a study), I receive direct feedback which fields are mandatory and which are not. I receive feedback if my input is ill-formed and can correct it right away.

NLP Features
~~~~~~~~~~~~

-----

NLP Integration
---------------

.. container:: user-story

   :Description:
     I as a user can request NLP support as an example for summarization and sentiment analysis.
   :Acceptance:
     As a regular user, in the annotator view I see when NLP models are connected. I can turn on and off NLP support. When submitting a commentary, it is automatically evaluated by a sentiment model; I see the result next to my comment. Below each highlight/annotation of sufficient length, I can request a summary from an NLP model. The result is shown as a response in the sidebar.

-----

NLP Skills
----------

.. container:: user-story

   :Description:
     I as an admin user can see the available NLP skills in the frontend.
   :Acceptance:
     As an admin user, I can see the NLP Skills component in the navigation sidebar. After accessing the component, I can see a of all connected NLP skills with the number of nodes supporting them. I can click on a button to see the details of the skill configuration for each of them.

-----

NLP Skill debugging
-------------------

.. container:: user-story

   :Description:
     I as an admin user can view the status of the broker, check the configurations of each skill that is online and send test messages to all available models.
   :Acceptance:
     As an admin user, when accessing the NLP dashboard component there is a status flag for the broker. If NLP endpoints are offline, this is clearly indicated. I also see a list of all skills, whether they are just fallback skills. For each skill, I can open the details on the configuration, copy the configuration and download it for re-use out of CARE. I can also send messages to a specific skill to test the respective model directly. I can view the responses and a history of messages for debugging.


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