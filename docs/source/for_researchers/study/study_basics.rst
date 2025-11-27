What is a Study?
================

In CARE, a **Study** is a controlled workflow that guides participants through a sequence of tasks, 
such as revising a document, annotating a PDF, or responding to AI-generated feedback.  
Studies are used in research settings to track how participants interact with documents and tools in a structured way.  

A study has two core parts: the **Study**, which defines the :ref:`workflow <workflows-and-steps>`, its steps, and options; 
and **Study Sessions**, which are the individual runs of the study for each participant, possibly at different times.  
Each participant creates a **study session** when they join a study via an invitation link. All edits, annotations, and 
interactions in that session are stored with a unique ``studySessionId``. Sessions are independent, allowing multiple 
participants to run the same study in parallel. Researchers can later analyze the data per session, including edits, 
annotations, and navigation behavior.  

.. note::

   Behaviour data (such as button clicks, scrolling, or sidebar toggling) are **only tracked if the user explicitly 
   accepted tracking in the consent form**. Without this consent, CARE does not log detailed interactions.

.. _workflows-and-steps:

Workflows and Steps
-------------------

A **workflow** defines the structure of a study.  
It consists of **steps**, where each step specifies:

- The **step type** (editor, annotator, or modal step).  
- Whether the participant may move **backward** to a previous step.  
- Any required **document** (HTML text or PDF).  
- Optional **step configuration**, which may include:
  
  - **services** (e.g., NLP feedback)  
  - placeholders  
  - modal appearance  

.. note::

   Be careful with the term *document*:  

   - In the **frontend**, the step definition tells CARE *which document should be opened* when that step runs.  
   - In the **database**, the step definition controls *whether a document is selectable* or *must come from another step’s output*.  
     For example, in the :ref:`Ruhr-Uni Bochum Project <ruhr-uni-bochum-project>`, the Step 3 editor is based on the results of the Step 1 editor rather than a newly chosen document.


Step Types
~~~~~~~~~~

- **Editor (Quill Editor)**  
  Used in workflows where participants write or revise text.  
  The editor tracks edits step by step, grouped by ``studySessionId`` and ``studyStepId``.  
  For background on the editor, see :doc:`../editor_usage`.

- **Annotator (PDF Viewer)**  
  Used in workflows where participants highlight, annotate, or comment on PDFs.  
  Annotations and comments are stored per session and per step, ensuring reproducibility.  
  The annotator provides features such as the sidebar, color-coded highlights, NLP support, and annotation downloads.  
  For technical details, see :doc:`Annotator <../../for_developers/frontend/components/annotator>`.

- **Modal Documents (Quill Editor with Placeholders)**  
  A modal document is rendered in a popup and cannot be edited directly by the participant.  
  Instead, it is dynamically filled with **placeholders** that are resolved at runtime.  
  This allows NLP results, comparisons, or step outputs to be displayed in a structured and visual way.

Placeholders
------------

Placeholders are only relevant for **Modal steps** (Step Type = 3).  
They allow inserting dynamic content such as text, charts, or comparisons into read-only modal documents,  
optionally powered by NLP skills.

For details on how to configure and use placeholders, see :doc:`Step Modal <../../for_developers/frontend/components/stepmodal>`.

.. _current-available-workflows:

Current Available Workflows
---------------------------

The following predefined workflows are currently available in CARE.  
Each workflow is a template that specifies the order of steps a participant goes through.  

**Step types**:  

- ``1 = Annotator`` (highlight or comment on a PDF)  
- ``2 = Editor`` (revise or write text in the Quill editor)  
- ``3 = Modal`` (a read-only view with dynamically filled placeholders, often used for NLP results)  

**Peer Review Workflow**  
~~~~~~~~~~~~~~~~~~~~~~~~

*Based on the EiWA Project: participants review a PDF document and then write free text feedback.*

- **Step 1 — Annotator:** The participant reads and annotates a PDF.  
- **Step 2 — Editor:** The participant writes their review in the text editor. They can move back to this step to revise their feedback if needed. The editor is linked to the same document annotated in Step 1.  

-----

**Ruhr-Uni Bochum Project**  
~~~~~~~~~~~~~~~~~~~~~~~~~~~

*Designed to study revision behavior over two editing rounds, with AI (NLP) feedback provided between them.*

- **Step 1 — Editor:** The participant writes or revises the initial version of a text.  
- **Step 2 — Modal:** AI-generated feedback is shown in a modal window. This includes comparisons (via the ``nlpEditComparison`` skill).  
- **Step 3 — Editor:** The participant revises the text again, building on both their first version and the AI feedback.  
- **Step 4 — Modal:** A second round of AI feedback is shown, again highlighting differences or suggestions.  

For a detailed step-by-step example, see :ref:`Ruhr-Uni Bochum Project <ruhr-uni-bochum-project>`.

-----

**Ruhr-Uni Bochum Project (Control)**  
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

*Same setup as the Ruhr-Uni Bochum Project, but without AI (NLP) feedback. Used as a control condition in experiments.*

- **Step 1 — Editor:** Participant writes or revises the text.  
- **Step 2 — Modal:** A modal view is shown, but without any AI feedback.  
- **Step 3 — Editor:** Participant revises the text again.  
- **Step 4 — Modal:** Another empty modal view is shown, serving as a placeholder instead of NLP results.  

-----

**Annotation Workflow**  
~~~~~~~~~~~~~~~~~~~~~~~

*A minimal workflow for pure annotation tasks.*

- **Step 1 — Annotator:** Participant highlights and comments on a PDF. This is the only step in the workflow.  

Creating a Study
----------------

This section describes how to create a new study in CARE.  
It includes preparing documents, adding placeholders, and defining the workflow.

Login and Document Preparation
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

1. Login to CARE using your username and password.  

2. Go to ``/dashboard/documents``. Click ``Add`` to upload a new pdf document which will be usable via the Annotator or click on ``Create`` to add a new document, which you will be able to customize in the next part.  

3. Choose a document type if you clicked on ``Create``:  

   - **General Editor Document**: Opens a plain editor. Can be used for preparatory steps like the first revision.  
   - **Study Modal Document**: Required for steps where dynamic placeholders are used. Name it clearly for later reference.  

.. note::

   Only **Study Modal Documents** can be used in modal steps (e.g., steps with placeholders).  

4. Once created, documents appear in the list. Use the icons on the right to access, delete, publish, or edit names.  

5. To insert placeholders in case of a **Study Modal Document**, open the document editor:  

   - Click where the placeholder should be added.  
   - Choose the placeholder type (text, chart, comparison).  
   - CARE auto-numbers placeholders to preserve order.  

6. After preparing all documents, click ``Go Back...`` to return to the documents page.  

Creating the Study
~~~~~~~~~~~~~~~~~~

7. Navigate to ``/dashboard/studies``.  

8. Click “Add” to open the study creation form.  

   - Fill in the **name** (required) and **description** (required). You can also customize: 
        - **duration**
        - **number of study sessions in general**
        - **number of study sessions per user**
        - **the study being collaborative**
        - **anonymization of comments**
        - **resumability**
        - **multible submissions** 
        - **start and end date and time**

   - Select a **workflow** (required). See workflows here: :ref:`workflows <current-available-workflows>`
   - Assign documents to steps (required). For editor and annotator steps, select the document to be edited or annotated. For modal steps, select the prepared **Study Modal Document** with placeholders.  

9. Save the study. Click ``Copy Link`` to share the invitation link with participants.  

.. note::

   Participants joining through this link will automatically start a new **Study Session**.

Working with Study Templates
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Study templates allow you to reuse study configurations for future studies, saving time and ensuring consistency.

**Creating Templates:**

You can create a template in two ways:

1. **From an existing study:**
   
   - After creating and saving a study, locate it in the studies list
   - Click on ``Save as template`` to convert the study configuration into a reusable template

2. **Directly from the Saved Templates modal:**
   
   - Navigate to ``/dashboard/studies``
   - Click the ``Saved Templates`` button
   - In the modal, click ``Create Template``
   - Define the workflow, settings, and document assignments
   - Save to create a new template without creating a full study first

**Using Templates:**

- Click ``Saved Templates`` to view all your saved templates
- Browse available templates with their configuration details (resumable, collaborative, multiple submissions, etc.)
- Click the ``Use`` button (play icon) on any template to create a new study based on that template
- The template's workflow and settings will be pre-filled, which you can then customize as needed

**Managing Templates:**

- Templates can be deleted from the Saved Templates modal (requires appropriate permissions)
- Templates are marked with the ``template`` flag and remain separate from active studies

Creating Assignment-Based Studies
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

CARE supports creating studies based on specific documents or imported submissions (e.g., from Moodle). This is particularly useful for peer review workflows or grading scenarios where you want to assign specific studies to reviewers.

**Single Assignment**

To create a study with a single assignment:

1. Navigate to ``Studies`` in the Dashboard
2. Click ``Add Single Assignment``
3. Select a study template (required)
4. Choose the assignment type:

   - **Documents**: Select from documents marked as ready for review
   - **Submissions**: Select from imported submissions (e.g., imported either from Moodle or manual inclusion)

5. Select the specific document or submission
6. Select one or more reviewers from the user list
7. Review and confirm the assignment details

**Bulk Assignments**

To create multiple assignments simultaneously:

1. Navigate to ``Studies`` in the Dashboard
2. Click ``Add Bulk Assignments``
3. Select a study template (required)
4. Choose the assignment type **Documents** or **Submissions**
5. Select multiple files from the table

   - Use filters and search to find specific details in the table
   - For submissions, you can filter by ``Group ID`` to organize assignments
6. Select reviewers

   - You can filter to show only users with documents
   - Filter to show only users from the selected documents/submissions
7. Configure the reviewer assignment strategy:

   **Role-based selection:**
   
   - Define how many reviews each user role should perform per file
   - Useful for distributing work evenly across teaching assistants, tutors, etc.
   - The system will automatically assign studies based on role quotas

   **Reviewer-based selection:**
   
   - Manually distribute documents among selected reviewers
   - Specify exactly how many documents each reviewer should handle
   - Total assignments must match the number of selected documents/submissions
8. Review the assignment summary showing total reviews to be created
9. Confirm to create all assignments

.. note::

   When creating bulk assignments with role-based selection, CARE automatically avoids assigning users to review their own documents or submissions.

.. tip::

   For Moodle-integrated workflows, see :doc:`Moodle Usage <../moodle_usage>` for details on importing submissions and publishing feedback back to Moodle.