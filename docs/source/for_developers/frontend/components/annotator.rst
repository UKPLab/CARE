Annotator
=========

The **Annotator component** (``frontend/src/components/annotator/Annotator.vue``) is CARE’s PDF-based annotation system.  
It allows users to highlight, tag, and comment directly on PDF documents, with full integration into studies, sessions, and collaborative workflows.  

Key features include:  
  - Rendering PDFs with zoom, scrolling, and dynamic page loading  
  - Selecting text spans and creating new annotations  
  - Highlighting annotations across sessions and users  
  - Sidebar with threaded comments, tags, and voting  
  - Integration with NLP services (summarization, sentiment)  
  - Exporting annotations and restoring scroll/session state  

Overview
--------

This documentation is intended to help understand the Annotator’s codebase and behavior.  
It outlines how PDFs are displayed, how annotations are anchored and highlighted, how comments are organized in the sidebar, and how the Annotator integrates into studies and document workflows.  

Implementing the Annotator
--------------------------

To implement and use the Annotator, follow the existing integrations in the codebase.  
The Annotator is typically used in document routes or in **study steps** (step type = 1).

**Basic example in a document route:**

.. code-block:: html

    <template>
      <Annotator :document-id="documentId" />
    </template>

.. code-block:: javascript

    import Annotator from "@/components/annotator/Annotator.vue";

    export default {
      components: { Annotator },
      props: { documentId: Number }
    };

**Example in a study workflow:**

.. code-block:: html

    <Annotator
      v-if="currentStep.stepType === 1"
      :document-id="currentStep.documentId"
      :study-step-id="currentStep.id"
      :active="true"
      @update:data="updateStudyData($event)"
    />

PDF Rendering and Selection
~~~~~~~~~~~~~~~~~~~~~~~~~~~

PDF rendering is handled by the **pdfViewer subfolder**:

- ``PDFViewer.vue``: Central component that loads the PDF (via pdf.js) and provides zoom controls.  
- ``PDFPage.vue``: Responsible for rendering each page (canvas + text layer) and maintaining anchors.  
- ``Adder.vue``: Appears after selecting text; shows available tags and allows creating a new annotation.  
- ``Highlights.vue``: Displays highlights for all annotations using SVG overlays.  
- ``pdfStore.js``: Manages caching of PDF pages and text content to improve performance.  

**Flow of creating an annotation:**

1. User selects text → ``Adder.vue`` detects selection.  
2. ``Adder.vue`` displays tag buttons → on click, annotation is created via WebSocket.  
3. Backend stores annotation and broadcasts to connected clients.  
4. ``Highlights.vue`` re-renders highlights on the affected page.  
5. ``Sidebar.vue`` updates with a new annotation card.

Sidebar and Comments
~~~~~~~~~~~~~~~~~~~~

The **sidebar** organizes all annotation threads:

- ``Sidebar.vue``: Container that can be resized or hidden. Handles scrolling to/from highlights.  
- ``AnnoCard.vue``: Root annotation card, showing tag, author, and first comment.  
- ``Comment.vue``: Displays replies with inline editing.  
- ``TagSelector.vue``: Allows changing or assigning tags.  
- ``VoteButtons.vue``: Provides upvote/downvote interaction on comments.  
- ``Collaboration.vue``: Manages real-time synchronization of comments and annotations, ensuring that all user interactions on documents are shared across clients.

Sidebar state (open/hidden, width, fixed mode) is saved in Vuex and restored on reload.  
In study mode, additional checks enforce whether comments are visible or hidden, depending on study/session settings.  

NLP Integration
~~~~~~~~~~~~~~~

If enabled, the Annotator can integrate with NLP services:

- Summarization of annotations or threads  
- Sentiment analysis of comments  
- Configurable thresholds (min/max text length, required skills)  

These are toggled via the Annotator’s top-bar and configured in ``settings``:  
- ``service.nlp.enabled``  
- ``annotator.nlp.activated``  
- ``annotator.nlp.summarization.*``  

Export and Persistence
~~~~~~~~~~~~~~~~~~~~~~

Users can export all annotations and comments for a document:

- **Export format:** JSON (annotations + comment threads merged)  
- **Access control:** controlled by ``annotator.download.enabledBeforeStudyClosing`` and study state  

The Annotator also persists user state:  
- **Scroll position and open page** are saved in ``user_environment`` when leaving the view.  
- **Sidebar width and visibility** are restored from saved settings.  

Collaboration and WebSockets
----------------------------

The Annotator relies heavily on real-time synchronization:

- **Events used:**  
  - ``annotationUpdate`` – create/update annotations  
  - ``commentUpdate`` – create/update comments  
  - ``commentGet`` / ``annotationGet`` – initial fetch  
  - ``appDataUpdate`` – update comment states, votes, etc.  
  - ``documentSubscribe`` – join/leave a document’s update stream  

- **Store integration:**  
  All annotations, comments, and votes are normalized in Vuex tables (``table/*``).  
  The Annotator listens to store updates and re-renders UI elements automatically.  

Study Mode vs Regular Mode
--------------------------

The Annotator behaves differently depending on context:

- **Regular mode:** annotations are global to the document and visible to all users.  
- **Study mode:** annotations and comments are scoped by ``studySessionId`` and ``studyStepId``.  
  This allows isolated workflows per participant and per step.  

.. note::

   When ``showAllComments`` is enabled in :doc:`the settings <../examples/settings>`, users may see comments from other sessions, 
   but restrictions apply depending on whether the study is still active or closed.  


