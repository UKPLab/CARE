Study
=====

This documentation explains the **purpose**, **props/events**, and **integration patterns** for each modal connected to study.  
Use these patterns to add study features or wire the modals into dashboards and routes.

Key features:

- **End-to-end session flow**: join/start, resume, finish, evaluate, and report.
- **Store-backed rendering**: lists of sessions, tags, comments, and annotations are pulled from :doc:`../vuex_store` ``table/*`` stores.
- **WebSocket actions**: starting/finishing sessions, updating evaluations, etc.
- **Navigation & telemetry hooks**: emit events to scroll the PDF/Sidebar, emit optional :doc:`../stats` events, and route back to :doc:`dashboard`.

StudyModal
----------

Location: ``frontend/src/components/study/StudyModal.vue``

**Purpose**  
Gatekeeper to a study: either **start/join** a session (collab or solo), **resume** open sessions, or **finish** specific ones from a table of sessions.

**Highlights**

- Renders a sessions table for the selected study with **contextual action buttons**:

  - **Start session** (if resumable = false and session not started)
  - **Resume session** (if resumable and started)
  - **Finish session** (close an open session)
- Shows study description (read-only) and meta-info (time limit, collab, session limits).
- Emits:

  - ``@start({ studySessionId })`` — after a successful ``studySessionStart`` socket call
  - ``@finish({ studySessionId })`` — when user triggers finish from the table

**Initialization / Data dependencies**

- Props:

  - ``studyId`` (Number, required)
  - ``studyClosed`` (Boolean)
  - ``studySessionId`` (Number, default 0)
- Reads from Vuex:

  - ``table/study`` (study meta, scheduling, constraints)
  - ``table/study_session`` (all sessions for the study, transformed for the table)
- WebSocket:

  - ``studySessionStart`` — start/join a session
- Optional stats: emits a ``stats`` event on session actions if ``acceptStats`` is provided via inject.

**Usage**

.. code-block:: html

   <StudyModal ref="studyCoordinator"/>

In a dashboard list:

.. code-block:: html

   <StudyModal ref="studyCoordinator"/>
   <ConfirmModal ref="deleteConf"/>
   <UploadModal ref="uploadModal"/>
   <CreateModal ref="createModal"/>
   <EditModal ref="editModal"/>
   <DownloadPDFModal ref="pdfDownloadModal"/>

In a study route:

.. code-block:: html

   <StudyModal
     v-if="studySessionId === 0 || (studySession && studySession.start === null)"
     ref="studyModal"
     :study-id="studyId"
     :study-closed="studyClosed"
     :study-session-id="studySessionId"
     @finish="finalFinish"
     @start="start"
   />

.. _finish-modal:

FinishModal
-----------

Location: ``frontend/src/components/study/FinishModal.vue``

**Purpose**  
Confirm final submission of a study; show *time up* information when applicable, then thank-you and link back to dashboard after finishing.

**Highlights**

- Props:

  - ``studySessionId`` (Number, required)
  - ``closeable`` (Boolean) — disables closing with keyboard/close button if false
  - ``showTimeUp`` (Boolean) — displays *time expired* message
  - ``finished`` (Boolean) — if already finished, auto-opens in thank-you view
- Emits:

  - ``@finish`` — when user clicks “Finish study”
- Navigation:

  - “Back to Dashboard” button after finish

**Usage**

.. code-block:: html

   <FinishModal
     ref="studyFinishModal"
     :study-session-id="studySessionId"
     :show-time-up="timeUp"
     @finish="finalFinish({ studySessionId: studySessionId })"
   />

ReviewModal
-----------

Location: ``frontend/src/components/study/ReviewModal.vue``

**Purpose**  
Allow a reviewer to **accept** or **decline** a **finished** study session with an optional comment.

**Highlights**

- Only actionable if the target session has an ``end`` timestamp (i.e., it’s closed).
- Props via inject:

  - ``studySessionId`` — used to fetch the session and to validate state
- Emits no custom event; instead it **writes via socket**:

  - ``studySessionUpdate`` with fields ``evaluation`` (0/1) and ``reviewComment``
- Computed:

  - ``evaluated`` checks if current session already has an evaluation

**Usage**

.. code-block:: javascript

   this.$refs.reviewModal.open();

ReportModal (+ ReportItem)
--------------------------

Location:

- ``frontend/src/components/study/ReportModal.vue``
- ``frontend/src/components/study/ReportItem.vue``

**Purpose**  
Generate a **review report** for a study by grouping annotations by tag (sections) and listing **general notes** (top).  
Each entry is clickable and **jumps to the PDF & Sidebar** position (see :doc:`annotator`).

**Highlights**

- Collects **annotations** (from all sessions of the current study) and **comments** without annotation (general notes).
- Groups by **tagId** to create sections (with tag color).
- Sorting:

  - Anchored annotations are sorted by ``TextPositionSelector.start`` (see :doc:`annotator`)
  - Items without anchors are listed first
- Interaction:

  - Clicking an item emits ``sidebarScroll`` and ``pdfScroll`` with the related id
- The **ReportItem** component:

  - Displays the annotation’s leading comment or “(no text)”
  - Shows a citation button rendering the **quote** (``TextQuoteSelector.exact``) as tooltip
  - Emits back to ReportModal which forwards PDF/Sidebar scroll events and closes itself

**Usage**

.. code-block:: javascript

   this.$refs.reportModal.open();

Assessment sidebar keyboard interaction
---------------------------------------

Location: ``frontend/src/components/study/assessment/AssessmentCriteria.vue``,
``AssessmentRubric.vue``, ``frontend/src/components/study/Assessment.vue``

**Purpose**

Allow a reviewer to fill in an assessment without the mouse, and make the
sidebar operable for keyboard-only and screen-reader users.

**Key map**

.. list-table::
   :header-rows: 1
   :widths: 25 30 45

   * - Key
     - Where
     - Behaviour
   * - ``Enter`` / ``Space``
     - rubric or criterion header
     - Expands or collapses the panel. Focus stays on the header.
   * - ``Enter``
     - edit button
     - Opens the editor and moves focus into the textarea.
   * - ``Ctrl+Enter`` / ``Cmd+Enter``
     - justification textarea
     - Commits the text (``saveEdit``) and moves focus to the score dropdown.
   * - ``Shift+Enter`` / ``Enter``
     - justification textarea
     - Inserts a newline. Native behaviour, deliberately not intercepted.
   * - ``Esc``
     - justification textarea
     - Cancels the edit, discards the text, focus returns to the edit button.
   * - ``Enter``
     - save button
     - Marks the criterion saved and advances to the next one.

``Ctrl+Enter`` is used rather than plain ``Enter`` to match
``components/annotator/sidebar/card/Comment.vue``, which already binds
``ctrl.enter`` to save. All key handlers use the ``.exact`` modifier, so a
shortcut never fires when an unintended modifier is held.

**Focus behaviour**

- Focus never moves when a panel merely expands — only after an explicit
  action (committing, cancelling, or marking a criterion done).
- After the last criterion of a rubric, ``focus-next-rubric`` opens the next
  rubric and focus lands on its first criterion header.
- After the final criterion of the final rubric, ``Assessment.vue`` emits
  ``assessment-advance-past-end`` and ``Study.vue`` focuses the *Next* or
  *Finish Study* control. Under ``forcedAssessment`` that button is enabled in
  the same render, so ``focusForwardControl`` retries for a few animation
  frames.

**Accessibility**

Both headers are ``<div>`` elements with ``role="button"``, ``tabindex="0"``,
``aria-expanded`` and ``aria-controls``, following the W3C ARIA Authoring
Practices accordion pattern. They are not native ``<button>`` elements because
the header contains an info icon with its own click handler, and nesting an
interactive element inside a button is invalid HTML.

Arrow-key navigation between headers (optional in the APG pattern) is **not**
implemented.

**Failed saves**

``saveAssessmentData`` now surfaces a toast on rejection
(``assessment.save.failedTitle`` / ``failedMessage``) instead of only writing
to the console.
