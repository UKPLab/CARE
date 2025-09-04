User Stories
============

Here you will find a list of the user stories to test the platform and developments, especially for deploying a new version.

Landing and Authentication
~~~~~~~~~~~~~~~~~~~~~~~~~~

-----

**Landing Page**

-----

.. list-table:: 
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a user, open the webpage localhost:3000 and see a landing page. The landing page includes a login/registration and pointers to the documentation.
   * - **Acceptance**
     - I access URL a page loads and some component loads and I can see an option to login/register/access documentation.

**Guest Login**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a user, open the webpage and can login as a guest to have basic user functionalities available.
   * - **Acceptance**
     - There is a "Login as guest" button on the login page. When I click on the button I am logged in as a guest user with all their rights and their specific view of the app.

**Registration**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a user, find a registration button on the login/landing page and can register as an individual user of the service specifying my credentials. I get feedback when my inputs are invalid.
   * - **Acceptance**
     - There is a registration button on the login/landing page. When I click on the login button I see a form, where I enter my first name, last name, email, user name, password etc. During entering of my information, I get feedback whether my inputs are valid (e.g. valid email format, password criterias). I am able to open/read/accept the consent and optional the behaviour logging. Upon clicking register, a user account is created in the database. I get a response, if registration was successful or unsuccessful.

**User Login**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a user, find a login button on the login/landing page. When I enter my username or email address and my password, I am logged in. I can see the webpage from my individual user's perspective.
   * - **Acceptance**
     - There is a login button on the login/landing page. I see a form where I can enter my credentials, either username or email with a password. When I click login, I get feedback that I am logged in. In case I use wrong credentials, I get a negative response and am not logged in. I am forwarded to my individual user dashboard. I now see the option to logout. When I click on logout, I am redirected to the login/landing page and am not logged in anymore.

Dashboard
~~~~~~~~~

-----

**PDF Documents**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a user, when logged in, see my individual dashboard including a view of my created documents, can upload new papers and delete existing papers and visit each paper.
   * - **Acceptance**
     - There is a table of documents visible in the dashboard. It shows the most important meta information including a title and creation timestamp. If there are no documents, the absence of documents is indicated by a message. For each document, I can press on a button to visit this specific document. For each document, I can press a button to delete it from the table of documents. When I press on the upload button, I can select a file from disc, it is added to the table with the respective filename and I can access it via the respective button. I can upload any type of textual PDF up to a roughly 50 pages and with many figures.

**HTML Documents**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a user can create an HTML document within the application. I can edit this document using an editor component. My changes persist and are visible when I revisit the application. I can also download the HTML document as a .html file to my local device.
   * - **Acceptance**
     - I can create a new HTML document through a UI action. I can make edits using an HTML editor component. My edits persist across sessions. I can download the document as a .html file. When I revisit the document later, it reflects the last saved version.

**Document Upload**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a user want to have feedback on the success of uploading a new document.
   * - **Acceptance**
     - In the dashboard, I can clearly see if the PDF was successfully uploaded to the server. I receive a clear message if this failed and a clear message if this was successful. Uploading multiple different documents pushes multiple different documents to the server.


**Renaming documents**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a regular user can change a document's name in the dashboard component.
   * - **Acceptance**
     - As a regular user, I see a button to edit the name of a document in the document table for each entry. When I click on this button I am prompted to add a new name. This change takes effect immediately and is stored on the server.

Annotator
~~~~~~~~~

-----

**PDF Viewer**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a user can visit the URL of a specific PDF document. I see the PDF document in a standard PDF viewer and the sidebar is present.
   * - **Acceptance**
     - For a given document by URL, the PDF loads as I uploaded it. It is shown in the PDF reader and rendered properly. I can select texts in the PDF (if it had text in the first place). The basic PDF functionalities are available. Loading takes no more than 1s or so, depending on the size. I see a progress bar during loading, if it should take longer.

**Color Coding**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a reviewer want to select different predefined tags for my annotations
   * - **Acceptance**
     - In the annotator view, I can select a span of text and now select from a range of color-coded categories to assign to my highlight and annotations. After selecting a category, the annotation with the associated tag shows up in the sidebar. The highlight color matches the tag color.

**Sidebar**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a user can visit the URL of a specific document, where next to the PDF I can see the sidebar on the right. It opens and it shows all annotations on that page.
   * - **Acceptance**
     - For a given document page, the sidebar is loaded next to the PDF document. The sidebar is open. If I created any annotations on this document beforehand, I can see them again. They are ordered by occurrence in the PDF. I see all tags and comments previously created. I can toggle the sidebar between show and hide.

**Creating annotations**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a user in the annotator view, can select a span of text in the PDF and store an annotation persistently.
   * - **Acceptance**
     - For a loaded annotator view, I can scroll through the PDF and select any text of reasonable length. The text is highlighted while doing so and a tag selection field pops up. Clicking on one of the buttons creates the annotation in the sidebar. My view scrolls automatically to this new annotation in the sidebar. If my selection was erroneous I see an error and the annotation is not created. In the sidebar I can add a comment and tags. After submitting the annotation it is stored persistently. If I abort the creation, it is discarded and not stored. If I do not interact with the sidecard, it is stored by default.

**Modifying annotations**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a user in the annotator view, can change any annotation in the sidebar.
   * - **Acceptance**
     - For a loaded annotator view, I can scroll through the sidebar and click on a delete and edit button for any annotation. Pressing delete discards the annotation and it is removed (together with its highlight) from the sidebar and the database. When pressing "edit", I can change the comments and tags of that annotation. Saving these changes stores them persistently.

**Annotation Navigation**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a user in the annotator view, can navigate through annotations and highlights dynamically.
   * - **Acceptance**
     - For a loaded annotator view, I can click on any annotation in the sidebar and the PDF view automatically scrolls to the right highlight. The highlight of the selected annotation becomes visually clear. When clicking on a highlight, the sidebar scrolls to the respective annotation in the sidebar.

**Document Note**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a reviewer want to have the option to leave comments that are not anchored in the text.
   * - **Acceptance**
     - In the annotator view, I see a button to add a document note. When I click this button a new comment is added to the sidebar. I can add tags and text to it and submit it as for regular annotations. The document note is not anchored in text and it becomes clear that this note is different from the other annotations.

**Comment Replying**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a regular user can reply to my or other user's comments.
   * - **Acceptance**
     - As a regular user, I can press a reply button on a comment in the sidebar. This creates a new comment in a reply thread and opens the thread to open information. When submitting the reply it becomes visible (in real time) to all users. I can reply to replies creating whole reply trees.

**Annotator Collaboration**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a regular user can collaborate with other users on a document and see their comments and highlights and edits in close to real time.
   * - **Acceptance**
     - As a regular user, I can access publish a document and share the link with other users. When we access the document in parallel and created highlights and comments in parallel, the changes are pushed to everyone that is accessing this document at the moment. Editing an existing comment shows an indication that the comment is currently edited.

Study Participation
~~~~~~~~~~~~~~~~~~~

-----

**Study View**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a regular user want to be able to access a document, start and participate in a study
   * - **Acceptance**
     - After receiving an invitation link to a study, I can access a paper via this link, where I have the option to join the study, or (if applicable) resume a previous session. In the annotator view, I can make my regular annotations. There is an easily visible review submission button. After confirming my decision to submit, I am lead back to the document overview showing me now a completed review. The study can also be accessed by any other regular user via the link.

**Study Coordinator**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a study coordinator want to be able to create an annotation study on top of a document, where users can join and realize their annotations in a controlled setting.
   * - **Acceptance**
     - As a regular user, I see the Study component in the navigation sidebar. Here I see a list of all ongoing studies and create new ones. I can also create a new study in the Documents component of the dashboard for a specific document. When creating a study I can configure the study title, description, collaboration settings and timings. After starting a study I can share a link with the participants, which I can copy from the table, and users can access this study.

**Study Session View**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a study participant want to be able to see all ongoing study sessions to pick them up again at a later point in time.
   * - **Acceptance**
     - As a regular user, I see the Study Session component in the navigation sidebar. Here I see a list of all study sessions that I started and finished, seperated by a title.  I can access and delete such a study session. After finishing a study session, it no longer shows in the table. I see the meta-information associated with the study in the table. I get live updates on the status of each associated study session.

**Close Study**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a user can close a study, marking it as inactive. This prevents new study sessions from being created. Any active study sessions are automatically closed.
   * - **Acceptance**
     - I can trigger a close action on a study. The study is marked as inactive. New sessions cannot be created under the closed study. Existing active sessions are terminated or marked as closed. The UI indicates that the study is now closed.

**Time Limit Crossed for Study Session**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a user am notified when the time limit for a study session is exceeded. The session is automatically marked as expired, and I can no longer continue but only review or finish it.
   * - **Acceptance**
     - Each study session with a time limit: When this limit is exceeded, the session is marked expired. A message is shown stating that the time has expired. The interface reflects this state and restricts further editing or annotation.

**Limit Study Sessions**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a study creator can define the total number of allowed sessions for a study and also limit how many sessions each individual user can create. Once limits are reached, session creation is blocked and a message is shown.
   * - **Acceptance**
     - As a study creator, I can set a maximum number of sessions for the study and per user. The system enforces these limits. If exceeded, users are shown an informative message and prevented from creating additional sessions. The UI reflects that limits have been reached.


Admin Features
~~~~~~~~~~~~~~

-----

**Admin View**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as an admin have an admin dashboard in addition to my regular user dashboard.
   * - **Acceptance**
     - In the dashboard, I see the additional navigation components on the sidebar that are only visible to admins. Clicking on them leads me to these components and allows to render their contents.

**Admin Settings**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as an admin user want to access and modify the settings of the system in the frontend.
   * - **Acceptance**
     - As an admin, I can see the Settings componentn in the navigation sidebar. When I access this, I can see the list of settings, reload them from the server backend, make changes and save these on the server. The changes have immediate effect on the behavior of the application.

**Admin Logs**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - As an admin user, I can see the server logs in the frontend.
   * - **Acceptance**
     - As an admin, I can see the Logs component in the navigation sidebar. When I access this, I can see the list of logs with meta information uncluding timestamps.

**User Statistics**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as an admin user can view the users and user behavior statistics in the frontend.
   * - **Acceptance**
     - As an admin user, I can see the User Statistics component in the navigation sidebar. When accessing the component I can see a list of all registered users. For each user, I can view the last login time. When selecting a user another table shows me the list of behavior logs. I can export all behavior logs of all users via a button click. All user behaviour statistics can be downloaded as csv or json.


UI Elements
~~~~~~~~~~~

-----

**Topbar**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a user want to see a topbar in the annotator view that grants me context-dependent functionalities and allows me to return to my dashboard.
   * - **Acceptance**
     - In the annotator/reviewer/editor view, there is a topbar on the page. It remains at the top while scrolling. There is a button to return to the user dashboard. There are potentially more buttons depending on the context of the current view of the document.

**Form input validation**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a regular user get feedback for all inputs on any form of CARE. This includes at least the registration, login, document edit modal, study edit modal and tagset edit modal.
   * - **Acceptance**
     - As a regular user, when I open a form to enter or change information on some data entity (e.g. a study), I receive direct feedback which fields are mandatory and which are not. I receive feedback if my input is ill-formed and can correct it right away.


NLP Features
~~~~~~~~~~~~

-----

**NLP Integration**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as a user can request NLP support as an example for summarization and sentiment analysis.
   * - **Acceptance**
     - As a regular user, in the annotator view I see when NLP models are connected. I can turn on and off NLP support. When submitting a commentary, it is automatically evaluated by a sentiment model; I see the result next to my comment. Below each highlight/annotation of sufficient length, I can request a summary from an NLP model. The result is shown as a response in the sidebar.

**NLP Skills**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as an admin user can see the available NLP skills in the frontend.
   * - **Acceptance**
     - As an admin user, I can see the NLP Skills component in the navigation sidebar. After accessing the component, I can see a table of all connected NLP skills with the number of nodes supporting them. I can click on a button to see the details of the skill configuration for each of them.

**NLP Skill debugging**

-----

.. list-table::
   :widths: 20 80
   :header-rows: 0
   :class: user-story

   * - **Description**
     - I as an admin user can view the status of the broker, check the configurations of each skill that is online and send test messages to all available models.
   * - **Acceptance**
     - As an admin user, when accessing the NLP dashboard component there is a status flag for the broker. If NLP endpoints are offline, this is clearly indicated. I also see a list of all skills, whether they are just fallback skills. For each skill, I can open the details on the configuration, copy the configuration and download it for re-use out of CARE. I can also send messages to a specific skill to test the respective model directly. I can view the responses and a history of messages for debugging.