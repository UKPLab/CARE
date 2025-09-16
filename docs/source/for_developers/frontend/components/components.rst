Components
==========

While :doc:`Basic <components>` contains reusable UI building blocks,  
the ``frontend/src/components`` folder contains **application-level components**.  
These components orchestrate workflows like document annotation, study execution, and the main dashboard.  

They integrate multiple base components and Vuex/socket logic to provide full functionality.

Code Structure Overview
-----------------------

Below are the **main components** you’ll find under ``frontend/src/components``.  
Each entry links to its dedicated documentation page:

.. toctree::
   :maxdepth: 2

   annotator
   dashboard
   document
   editor
   stepmodal
   study

-----

Dashboard
---------

The :doc:`Dashboard <dashboard>` is the central landing view after login.  
It loads navigation entries from the store (``nav_element``) and dynamically renders the active module into the main viewer pane.  

- The **sidebar** provides navigation based on Vuex-managed entries.  
- The **viewer** dynamically loads the selected component (via ``defineAsyncComponent``).  
- Default modules can be configured via ``dashboard.navigation.component.default`` in the settings.  

.. code-block:: html

    <div class="dashboard-wrapper">
      <Sidebar />
      <component :is="currentComponent" />
    </div>

This makes the Dashboard the entry point to most of CARE’s functionality.  

-----

Document
--------

The Document decides whether to show the :doc:`Annotator <annotator>` or the :doc:`Editor <editor>`
based on the document type stored in Vuex.  

- **Annotator**: For document type 0 (DOC_TYPE_PDF).  
- **Editor**: For document types 1 (DOC_TYPE_HTML) and 2 (DOC_TYPE_MODAL).  

Additional responsibilities:  

- Handles ``beforeRouteLeave`` guards to confirm unsaved changes.  
- Responds to socket errors (e.g., missing document, permission issues).  
- Integrates with the toast system to inform the user of failures.  

.. code-block:: html

    <Editor v-if="doc.type === 1" :document-id="id" />
    <Annotator v-else :document-id="id" />

This route provides the foundation for all document interactions outside of studies.  

-----

Study
-----

The :doc:`Study <study>` component organizes **full study execution**.  
It combines annotation, editing, and step-based tasks into a coherent workflow:  

- Prompts the user to **start or resume** a study with a :ref:`StudyModal <study-modal>`.  
- Displays the correct step type:  

  - **Annotator** (stepType 1)  
  - **Editor** (stepType 2)  
  - :doc:`StepModal <stepmodal>` (stepType 3)  
- Manages **step navigation** (previous/next buttons in the topbar).  
- Tracks **timing and deadlines**.  
- Provides a **FinishModal** for submission and study closure.  

**Key integrations:** Vuex (study, study_step, study_session tables), socket events, topbar controls.  

.. code-block:: html

    <Annotator v-if="step.type === 1" />
    <Editor v-if="step.type === 2" />
    <StepModal v-if="step.type === 3" />

The Study component is the **core container for study mode**, turning individual base components into a guided workflow.  

-----

Study Session
-------------

The StudySession component is a **specialized wrapper** around :doc:`Study <study>`.  
Its purpose is to **resume existing sessions** (via ``studySessionHash``).  

- Fetches the study session object from the backend (via sockets).  
- Passes the resolved ``studySessionId`` into the Study component.  
- Handles error cases (e.g., invalid or expired session hashes) and shows appropriate toasts.  
- Ensures consistent state restoration when a user re-opens a session.  

.. code-block:: html

    <Study
      v-if="studySessionId"
      :init-study-session-id="studySessionId"
      :read-only="readOnly"
      :study-hash="studyHash"
    />

By separating session resumption into its own component, CARE cleanly distinguishes between:  

- **Starting or creating a new study session** → handled in :doc:`Study <study>`.  
- **Resuming an existing session** → handled in **StudySession**.  