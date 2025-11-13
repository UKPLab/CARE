Applying NLP Skills to Documents
=================================

CARE allows administrators to apply NLP skills to files (currently, documents and submissions) as batches with same configurations.
This feature enables preprocessing of large file collections with configured NLP models
and automatic storage of results for further analysis.

When to Use Skill Application
-----------------------------

Use the skill application feature to:

- **Preprocess submissions** with NLP models before study participants begin, to avoid latency during interaction
- **Validate NLP model outputs** for different inputs and scenarios
- **Prepare ground truth data** for model evaluation studies
- **Generate baseline predictions** for human-in-the-loop workflows (eg., Peer Review Workflow with AI)
- If annotations for documents are created, **pre-generate NLP results** to compare human vs. model annotations
- **Comparison studies** with and without NLP support can be facilitated using the same platform, avoiding external factors affecting separate setups

Accessing Skill Application
----------------------------

Skill application is available in the **Dashboard** under the **Submissions** component.

.. note::

   Only administrators can access the selection of skill application, displays NLP skills that are online only, if there are no online skills then the fallback will be activated.
   Regular users cannot initiate or monitor preprocessing tasks.

**To open the skill application interface:**

1. Log in as an administrator
2. Navigate to the **Dashboard**
3. In the left sidebar, click **Submissions**
4. Click on **Apply Skills**

The **Apply Skills** modal will open with a step-by-step wizard.

Configuration Steps
-------------------

**Step 1: Select Skill**

Choose an NLP skill from the dropdown. The available skills are shown with their status (online/offline) .
To understand what a skill does before selecting it, check the **NLP Skills** component in the dashboard, which shows:

- Input parameters and expected input formats
- Output fields and their meanings  
- Full configuration details

**Step 2: Map Parameters to Data Sources**

For each skill input parameter, select a data source:

- **Submission**: All documents from a submission (for multi-document analysis saved as a submission)
- **Document**: A specific individual document
- **Configuration**: A configuration of type ``assessment``

..note::

   You can select only one table-based data source(submission or document) in total for all parameters.

**Step 3: Select Files to Process**

Choose which specific files (submissions or documents) to apply the skill to. 
The selection interface shows available files grouped by validation configuration.
You must select at least one file.

Step 4: Select Base Files (submission-based parameter selections only)
--------------------------------------------------------

If the skill operates on submissions (not individual documents), you must specify which document type 
to save results to, since submissions contain multiple documents.

For each group ( groups are based on shared validation configuration ), choose the target document type for that specific submission-group (pdf, html, modal, etc.).

.. note::

   This step only appears for submission-based skills.
   Document-based skills save directly to the selected document.

**Step 5: Review and Confirm**

Review the configuration summary showing:

- Selected skill and parameters
- Number of files selected
- Total number of requests to be created

Click **Apply Skills** to submit.

Monitoring and Results
----------------------

**During Processing:**

After submission, the modal shows real-time progress:

- Progress bar (X / Y requests completed)
- Current request elapsed time
- Estimated time remaining
- Queue of submissions still waiting

You can close the modal; processing continues in the background.
Re-open "Apply Skills" anytime to check progress.

**Cancelling Pre-processing:**

Click **Cancel Preprocess** to stop remaining requests.
Already-completed requests remain saved in the database.

**Reviewing Results:**

Results are automatically saved to documents in the ``document_data`` table with keys like:

.. code-block:: text

    nlpRequest_grading_expose_assessment

Access results by:

Looking at the ``document_data`` table for the corresponding combination of ``documentId``, ``studySessionId``, ``studyStepId`` and ``key``.
If this is integrated into a study, results can be accessed via the component's data sources while configuring the study.

Error Handling
--------------

**If processing fails for specific items:**

- Error is logged to backend; processing continues with next item
- Check backend logs for details
.. - Failed items are listed in the modal's queue with error messages

**Common issues:**

- **Files missing**: File deleted from disk or database
- **Processing latency**: Skill took too long; check the cancellation view or backend logs for details
- **NLP timeout**: Skill took too long; increase timeout in settings
- **Skill offline**: Check NLP Skills component for status
- **No results stored**: Verify base file selection was correct

Best Practices
--------------

- **Correct selections**: Ensure the skill name, input parameters are mapped to correct data sources, correct files and base files are chosen appropriately
- **Start small**: Test with 1-5 submissions first to verify skill configuration and its functionality before running large batches
- **Review results**: Always manually check initial results to assess model quality and correct functionality in CARE
- **Monitor time**: Watch elapsed time; if requests exceeds the expected duration, something may be wrong
- **Document your runs**: Note which skills ran on which submissions and when, for reproducibility
- **Check permissions**: Only admins can run skill application; results are stored under your userId

Troubleshooting
---------------

**No skills appear in dropdown**
  - Skill Broker is either offline or no models connected (fallbacks are visible). 
  - Check ``NLP Skills`` component.

**Can't proceed past Step 1**
  - You must map at least one parameter to a table-based source (submission or document).

**Error during processing**
  - Make sure, that the inputs selected match the requirement for the skill.
  - Check backend logs for specific error messages related to the skill or data.  

**Processing takes very long**
  - Skill may be slow or offline. 
  - Check cancellation view, backend logs or the broker for errors. Cancel and retry if needed.

**Results don't appear in document_data**
  - Verify base file selection was correct. 
  - Check that the documentId exists in the database.

**Results look incorrect**
  - Test the skill manually using the NLP Skills message interface. Compare against expected output.
