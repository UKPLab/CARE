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

.. note::

	System workflows are pre-defined and cannot be modified by users while user workflows are workflows created by the logged-in user.

At the top-right of the card, you can:

* **Add Workflow**
* **Export All** workflows
* **Import** workflows from file\

For each workflow row, available actions include:

* **Copy Workflow**
* **Edit Workflow**
* **Rename Workflow**
* **Export Workflow**
* **Toggle Hidden** (show/hide in frontend)
* **Delete Workflow**

.. note::

	Editing actions are restricted to administrators or the workflow owner.


Workflow Creation
-----------------

To create a new workflow:

1. Go to **Dashboard → Workflows**.
2. Click **Add Workflow**.
3. Fill in the workflow form:

	* ``name`` (required)
	* ``description`` (required)
	* ``hideInFrontend`` (optional switch)

4. Save the workflow.

To create from an existing workflow:

1. Use **Copy Workflow** in the workflow row.
2. A new workflow is created with the selected workflow as its parent.
3. Existing steps are copied in order, including internal step links.

To rename a workflow:

1. Click **Rename Workflow**.
2. Enter the new name and confirm.

You can also exchange workflows between instances:

* **Export** supports JSON and YAML.
* **Import** supports JSON and YAML and lets you select specific workflows before import.


Workflow Steps Management
-------------------------

Click **Edit Workflow** to open the workflow graph editor.

In this editor, each node represents a workflow step. You can:

* Add a step before or after another step
* Edit a step
* Copy a step for reuse
* Inspect a step
* Delete a step
* paste a step before or after another step (after copying it)

When creating or editing a step, configure:

* ``name`` (required)
* ``stepType`` (Annotator, Editor, or Modal)
* ``allowBackward`` (allow backward navigation)
* ``configuration`` (optional JSON object configuring the step, e.g., which skill to use)

CARE maintains workflow order via the predecessor relationship of each step.
In practice, this means steps form a linked sequence, and changes in the editor update this sequence.

.. tip::

	Use **Copy Workflow** when you need a reusable template with the same step structure, and then adapt only the steps that differ for your new study.
