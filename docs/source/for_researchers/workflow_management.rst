Workflow Management
===================

This chapter explains how to manage workflows in CARE from the dashboard, how to create new workflows, and how to maintain workflow steps.

Workflow Dashboard
------------------

Open the **Workflows** card in the dashboard to see all workflows available to you.

The table includes:

* **ID** and **Name**
* **Type** (System or User)
* **Hidden** (whether the workflow is hidden in the frontend)
* **Created** and **Last Update** timestamps

Workflow type and editability
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The **Type** column is important for permissions and maintenance:

Visibility rule:

* A **System** workflow is visible to all users.
* A non-system workflow (Type **User**) is visible only to the user who created it.

* **System**: predefined workflow templates provided by the CARE instance.
	These are intended as reference baselines and are usually not editable by regular users.
* **User**: workflows created by users in the dashboard.
	These are the workflows you adapt for your own study setup.

In practice, if you want to customize a system workflow, the safe path is:

1. **Copy Workflow** on the system workflow.
2. Edit the copied user workflow.
3. Use the copied one in your study.

Hidden flag and where it applies
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The **Hidden** column corresponds to ``hideInFrontend``.

* If hidden is **Yes**, the workflow is not shown in workflow selection lists in the frontend
	(for example, when selecting a workflow during study creation or study template creation).
* If hidden is **No**, the workflow appears normally in workflow selection views.

Use this when you want to phase out an older workflow without deleting it.
This lets you keep historical workflows for reproducibility and documentation,
while guiding users to the new workflow version.

Top-right actions: what they change
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

At the top-right of the card, you can:

* **Add Workflow**
* **Export All** workflows
* **Import** workflows from file

Consequences of these actions:

* **Add Workflow** creates a new workflow record; initially it has no steps until you add them in the editor.
* **Export All** creates a portable snapshot (JSON/YAML) of workflow definitions and their steps.
	This is useful for backup, transfer across instances, and versioned study preparation.
* **Import** creates new workflows from JSON/YAML.
	Imported workflows are independent copies; changing an imported workflow does not change the source instance.

Row actions: when to use which
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

For each workflow row, available actions include:

* **Copy Workflow**
* **Edit Workflow**
* **Rename Workflow**
* **Export Workflow**
* **Toggle Hidden** (show/hide in frontend)
* **Delete Workflow**

Action guidance:

* **Copy Workflow**: best for creating a variant while preserving the original as baseline.
* **Edit Workflow**: opens the graph-based step editor for structural and configuration changes.
* **Rename Workflow**: creates a renamed successor and deprecates the previous one in the workflow lifecycle.
* **Export Workflow**: exports one workflow only (good for sharing a single template).
* **Toggle Hidden**: soft lifecycle control (active vs. archived visibility) without hard delete.
* **Delete Workflow**: removes it from active use and cascades step deletion; use only if you no longer need it.

.. note::

   Editing actions are restricted to administrators or the workflow owner.


Workflow Creation
-----------------

**To create a new workflow:**
1. Go to **Dashboard → Workflows**.
2. Click **Add Workflow**.
3. Fill in the workflow form:

	* ``name`` (required)
	* ``description`` (required)
	* ``hideInFrontend`` (optional switch)

4. Save the workflow.

Recommended practice:

* Use clear names that encode purpose and version (for example, ``Peer Review v2 - with rubric``).
* Use the description to record study intent and special behavior (e.g., "includes NLP comparison modal").

**To create from an existing workflow:**

1. Use **Copy Workflow** in the workflow row.
2. A new workflow is created with the selected workflow as its parent.
3. Existing steps are copied in order, including internal step links.

This is the preferred way to create controlled variants for A/B-style study conditions.

**To rename a workflow:** 

1. Click **Rename Workflow**.
2. Enter the new name and confirm.

Use rename for semantic cleanup (clearer naming), and copy for behavioral changes.

**To exchange workflows between instances:**

* **Export** supports JSON and YAML.
* **Import** supports JSON and YAML.

.. tip::

  You can select specific workflows during import, which is useful when migrating only part of your workflow set to another instance.

Workflow Steps Management
-------------------------

Click **Edit Workflow** to open the workflow graph editor.

In this editor, each node represents a workflow step. You can:

* Add a step before or after another step that enables you to freely insert your steps in the workflow
* Edit a step to change its type, configuration, and behavior
* Copy a step to reuse it in another part of the workflow or in another workflow 
* Inspect a step 
* Delete a step
* Paste a step before or after another step (after copying it)

Step ordering and navigation
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

CARE stores steps as a linked sequence.

* ``workflowStepPrevious`` defines the predecessor step.
* ``allowBackward`` controls whether users can navigate back from the current step.

When you insert/delete/move steps in the graph editor, these links are updated to preserve a valid trajectory.

When creating or editing a step, configure:

* ``name`` (required)
* ``stepType`` (Annotator, Editor, or Modal)
* ``allowBackward`` (allow backward navigation)
* ``configuration`` (optional JSON object with step behavior)

Understanding ``stepType``
~~~~~~~~~~~~~~~~~~~~~~~~~~

* **Annotator**: annotation-focused interaction with document and comments.
	See :doc:`Annotator component details <../for_developers/frontend/components/annotator>`.
* **Editor**: editing-focused interaction for revising text.
	See :doc:`Editor component details <../for_developers/frontend/components/editor>`.
* **Modal**: structured modal step, often used for feedback views, comparisons, or service-based outputs.
	See :doc:`StepModal component details <../for_developers/frontend/components/stepmodal>`.

Configuration reference (what users will encounter)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The ``configuration`` object is a set of key value pairs that control the behavior of a study step.

The configuration consists of: ``settings``, ``services``, ``placeholders`` and other keys.

In practice, this configuration layer is mainly used for NLP model integration workflows.

For the ``settings.fields`` structure and supported form field options, see
:doc:`Basic Form documentation <../for_developers/frontend/basic/form>`.

.. list-table:: Settings keys
   :header-rows: 1
   :widths: 20 20 40 20

   * - Name
     - Value type
     - Description
     - StepType applicability
   * - ``forcedAssessment``
     - ``boolean``
     - Whether a user is forced to save all assessment criteria before proceeding.
     - Annotator, Editor
   * - ``showAllDocumentAnnotations``
     - ``boolean``
     - Whether all document annotations are shown in the current step.
     - Annotator
   * - ``configurationId``
     - ``string`` 
     - Reference to a configuration document (for example, a rubric) used in this step; this key activates the assessment sidebar.
     - Annotator, Editor (with assessment component)
   * - ``modalSize``
     - ``string``
     - Size of the modal (``"sm"``, ``"md"``, ``"lg"``, ``"xl"``) when stepType is Modal.
     - Modal only


.. list-table:: Services 
    :header-rows: 1
    :widths: 20 40 40

    * - Name
      - Value examples
      - Description
    * - ``name``
      - ``"nlpAssessment"``
      - Service identifier to call in this workflow step.
    * - ``type``
      - ``"nlpRequest"``
      - Service invocation type.
    * - ``required``
      - ``true``
      - If true, the step expects successful service output.

.. list-table:: services keys
   :header-rows: 1
   :widths: 20 40 

   * - Name
     - Description
   * - ``nlpAssessment``
     - is used for the grading workflows in EiwA, so for requesting a model to assess the submission based on the uploaded submission files.
   * - ``nlpTextualFeedback``
     - it is used to generate feedback based on the assessment made and the uploaded submission files.


.. list-table:: placeholder
    :header-rows: 1
    :widths: 20 40 40
  
    * - Name
      - Value examples
      - Description
    * - ``text``
      - ``[{"input": {"stepId": 2, "dataSource": "summary_text"}}]``
      - Text placeholders that pull data from previous steps.
    * - ``chart``
      - ``[{"input": {"stepId": 4, "dataSource": "frequency_chart"}, "title": "Edits by Type"}]``
      - Chart placeholders that render visualizations from previous step outputs.
    * - ``comparison``
      - ``[{"input": [{"stepId": 5, "dataSource": "revisionA"}, {"stepId": 6, "dataSource": "revisionB"}], "labels": ["R1", "R2"], "title": "Revisions Compared"}]``
      - Comparison placeholders that juxtapose multiple inputs with labels and an optional title.


Other top-level configuration keys
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

.. list-table:: Other top-level keys in configuration
   :header-rows: 1

   * - Name
     - Value type
     - Description
     - StepType applicability
   * - ``readOnlyComponents``
     - ``array``
     - For Modal steps, specifies which components (for example, "annotator", "assessment") are read-only in this step.
     - Modal only
   * - ``showAllDocumentAnnotations``
     - ``boolean``
     - Whether to show all document annotations in this step (applicable to Modal steps).
     - Modal, Annotator
   * - ``previousAssessmentData``
     - ``number``
     - For Modal steps, specifies a previous step to pull assessment data from for display in this step.
     - Editor, Annotator (with assessment sidebar)
      
Detailed examples from predefined workflows
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Example A: required NLP comparison service in a modal step

.. code-block:: json

	 {
		 "services": [
			 {
				 "name": "nlpEditComparison",
				 "type": "nlpRequest",
				 "required": true
			 }
		 ]
	 }

Use case: ensure comparison output is generated before users proceed.
If the service is unavailable, the step may block or degrade depending on UI/service handling.

Example B: revision assessment controls

.. code-block:: json

	 {
		 "settings": {
			 "fields": [
				 {
					 "key": "configurationId",
					 "type": "select",
					 "required": true
				 },
				 {
					 "key": "forcedAssessment",
					 "type": "switch",
					 "default": false
				 },
				 {
					 "key": "showAllDocumentAnnotations",
					 "type": "switch",
					 "default": true
				 }
			 ]
		 },
		 "previousAssessmentData": 1,
		 "readOnlyComponents": ["annotator", "assessment"],
		 "placeholders": false
	 }

Use case: configure rubric source, enforce mandatory scoring, and control whether annotations are visible.

Example C: assessment workflow configuration with NLP service

.. code-block:: json

   {
     "settings": {
       "fields": [
         {
           "key": "configurationId",
           "label": "Configuration File:",
           "type": "select",
           "required": true,
           "options": {
             "table": "configuration",
             "name": "name",
             "value": "id",
             "filter": [
               { "key": "type", "value": 0 },
               { "key": "deleted", "value": false }
             ]
           }
         },
         {
           "key": "forcedAssessment",
           "label": "Forced Assessment",
           "type": "switch",
           "default": false
         }
       ]
     },
     "services": [
       {
         "name": "nlpAssessment",
         "type": "nlpRequest",
         "required": true
       }
     ],
     "placeholders": false
   }

Use case: configure an assessment step that requires rubric selection and triggers an NLP assessment request.

Configuration safety checklist
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Before releasing a workflow to participants:

1. Validate JSON format (no trailing commas, valid quoting).
2. Confirm referenced entities exist (skills, configuration documents, expected step references).
3. Test one complete run with a non-admin test account.
4. Verify backward navigation and hidden-state behavior are exactly as intended.

.. tip::

	 Keep one stable, hidden "template" workflow and create visible study-specific copies from it.
	 This makes later comparisons and debugging much easier.
