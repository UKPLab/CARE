Moodle API for Researchers
==========================

This guide provides a general-purpose, researcher-friendly overview of how to interact with the Moodle API in a privacy-conscious and ethically sound way. It includes information on how to access, use, and integrate Moodle data in studies without exposing private implementation or personal information.

.. note::

   This documentation is meant for researchers and non-developers. If you're a developer working with the backend or extending RPC functionality, refer to the :doc:`Moodle API technical guide <../for_developers/backend/rpcs/moodle>`.

Overview
~~~~~~~~

The Moodle API allows authorized users to retrieve information from Moodle courses, including course participants and their assignment submissions. It is typically used in research to analyze student activity or manage study workflows, such as collecting submissions or publishing feedback.

.. caution::

   Never use the Moodle API to collect or process personally identifiable information (PII) unless explicitly authorized by your institution and research ethics board.

Setup & Access
~~~~~~~~~~~~~~

To use the Moodle API, you will need the following:

- **API Key**: Issued by the Moodle system administrator.
- **API URL**: The base URL of your Moodle instance (e.g., `https://moodle.university.edu`).
- **Course ID**: Numeric ID of the course you are working with.

These values must be entered in the CARE platform or your analysis tool to initiate data access.

Working with the CARE Platform
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

CARE integrates with Moodle to support data collection and feedback distribution. Depending on your study design, you may perform one or both of the following tasks:

1. **Importing Submissions from Moodle**
2. **Publishing Feedback or Study Results to Moodle**

Assignment Setup in Moodle
~~~~~~~~~~~~~~~~~~~~~~~~~~

Assignments should be created with specific settings to enable smooth integration:

- **For collecting submissions:**
  - Submission type: *File submissions*
  - Feedback type: *Feedback comments*
  - Student submit button: *No*
  - Require submission statement: *Yes*

- **For publishing feedback only (no student upload):**
  - Submission type: *None*
  - Feedback type: *Feedback comments* (Inline: *No*)
  - Grade type: *None*
  - Completion conditions: *None*

Importing Submissions from Moodle
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Once assignments are configured and students have submitted files:

1. Navigate to the CARE platform
2. Go to **Review Documents**
3. Select **Import via Moodle**
4. Choose the course and assignment ID
5. Imported files will appear in the CARE dashboard

.. tip::

   Each student's submission may contain multiple files. You can select the target file during study creation.

Creating Studies in CARE
~~~~~~~~~~~~~~~~~~~~~~~~

You can create a new study using a predefined template or from scratch:

1. Go to **Studies > Add Single Assignment**
2. Choose a template or create new
3. Assign documents and reviewers
4. Optionally rename the study to differentiate sessions

Account Matching & Importing Users
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

CARE supports importing users directly from Moodle courses:

1. Go to **Users > Import via Moodle**
2. CARE will match accounts using email addresses

There are three scenarios:

- **New users**: Accounts are created automatically
- **Duplicate users**: Accounts are merged if emails match
- **Unverified users**: If email differs, manual correction is required

.. warning::

   Never delete users with an `extId` (external Moodle ID) unless absolutely necessary. Doing so may break future synchronizations.

Publishing Feedback via Moodle
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

To publish feedback or credentials back to students via Moodle:

1. Ensure the study is marked as **Finished**
2. Go to **Review Documents > Publish Reviews**
3. Select the completed session and assignment
4. Click **Upload to Moodle**

Only students with valid `extId`s will receive feedback.

Ethical Guidelines
~~~~~~~~~~~~~~~~~~

- Always follow GDPR and institutional ethics guidelines
- Use anonymized or aggregated data whenever possible
- Avoid storing or transferring student names, email addresses, or user IDs unless explicitly authorized

Troubleshooting
~~~~~~~~~~~~~~~

- If submissions are not visible, check assignment configuration in Moodle
- If user accounts aren't matching, verify that emails are identical across both platforms
- For missing `extId` values, re-import users from Moodle with correct course ID

Frequently Asked Questions
~~~~~~~~~~~~~~~~~~~~~~~~~~

**Q: How do I find the course or assignment ID?**

A: Open the course or assignment in Moodle. The URL will contain `id=XXXX`. That number is the ID.

**Q: Can I select specific files from a submission with multiple documents?**

A: Yes, CARE allows selecting the target file during study setup.

**Q: Can I test the API without publishing feedback?**

A: Yes, you can import data and view it in CARE without publishing anything back to Moodle.

References
~~~~~~~~~~

- `Moodle Web Services API Documentation <https://docs.moodle.org/dev/Web_services>`_
- `Moodle Plugin Development <https://moodledev.io/docs/apis/core/dml>`_

