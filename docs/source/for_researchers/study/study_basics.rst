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
- Optional **services** (e.g., NLP feedback).  
- Optional **step configuration** such as placeholders, modal appearance, or custom fields.

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

- **Modal Documents (Quill Editor with Placeholders)**  
  A modal document is rendered in a popup and cannot be edited directly by the participant.  
  Instead, it is dynamically filled with **placeholders** that are resolved at runtime.  
  This allows NLP results, comparisons, or step outputs to be displayed in a structured and visual way.

Placeholders
------------

**Placeholders are only available in Modal steps**. A Modal step renders a read-only document and dynamically fills
placeholder blocks with data gathered from earlier steps and/or outputs produced by NLP skills.  
**NLP is executed only when a placeholder explicitly uses it**. For example, a *comparison* placeholder can trigger the
``nlpEditComparison`` skill; if no placeholder references an NLP output, no NLP requests are made in that step.

Overview
~~~~~~~~

- Insert placeholders (e.g., ``~text~``, ``~chart~``, ``~comparison~``) into a **Study Modal Document**.
- During study setup, open the **step configuration** and:

  - (Services) Declare which **NLP skills** can be used *by placeholders* in this step and map their **inputs** from previous steps.
  - (Placeholders) For **each placeholder instance** map the **data sources** it should render (either direct content from earlier steps or the outputs from declared NLP services).

Placeholder Types
~~~~~~~~~~~~~~~~~

- **Text:** Renders textual content pulled from a mapped data source (e.g., “First Version”, “Current Version”, or an NLP output).
  Typical use: show a short generated summary or guidance text.

- **Chart:** Renders a visualization from JSON-like data. The data can come from earlier steps or from an NLP skill’s structured output.

- **Comparison:** Renders a side-by-side comparison of two mapped inputs (e.g., “First Version” vs. “Current Version”).  
  This placeholder commonly **uses an NLP skill** (e.g., ``nlpEditComparison``) to compute diffs, highlights, or metrics.

Configuration Flow
~~~~~~~~~~~~~~~~~~

1. **Prepare the Modal Document**  
   In the editor, insert the placeholders where you want dynamic content to appear. CARE auto-numbers them in order.

2. **Declare Services (NLP) for the Step** *(Modal steps only)*  
   In the step’s configuration dialog:

   - Select an **NLP skill** from the broker’s available skills.
   - Define the **input mapping** for that skill by choosing data sources from earlier steps (e.g., *First Version*, *Current Version*, or outputs of prior skills).
   - These services produce named outputs that placeholders can reference.

3. **Configure Each Placeholder**  
   In the “Placeholders” tab of the step configuration:

   - For **Text** and **Chart** placeholders, choose **one data source** (either a step output or an NLP output).
   - For a **Comparison** placeholder, choose **two data sources** (often feeding an NLP comparison skill).
   - Preview a short snippet with colored markers to verify mapping and order.

Runtime Behavior
~~~~~~~~~~~~~~~~

- When the participant reaches the Modal step, CARE scans all placeholders.  
- If a placeholder references an **NLP output** that is not stored yet, the step:

  1) triggers the relevant **NLP service request** with the configured inputs,  
  2) **persists** the returned outputs for this session/step, and  
  3) renders the placeholder with the produced data.
- If NLP times out or is disabled, the modal follows your configured fallback (retry or continue to next step).

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

For a detailed step-by-step example, see :doc:`study_with_nlp`.

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