Moodle API
==========

This guide provides an overview of how to interact with the Moodle API, including how to access, use, and integrate Moodle data in studies.

.. note::

   This documentation is meant for researchers and non-developers. If you're a developer working with the backend or extending RPC functionality, refer to the :doc:`Moodle API technical guide <../for_developers/backend/rpcs/moodle>`.

Overview
--------

The Moodle API enables authorized users to connect to a `Moodle Instance <https://moodle.org/>`_ and access course-related data. Researchers typically use this functionality to:

   - Import student submissions for annotation or evaluation
   - Distribute study results or feedback
   - Import user data 

.. note::

   We recommend obtaining approval from your research ethics committee before importing user data, as these may include personally identifiable information (PII).

.. _moodle_api_setup:

Setting Up the Moodle API
--------------------------

To use the Moodle API, you will need access credentials and permissions configured in your Moodle instance.

You will need:

- **API Key**:  
  Issued by your Moodle system administrator. It must grant access to course and user data relevant to your study.

- **API URL**:  
  The base URL of your Moodle instance (e.g., `https://your-moodle-instance.edu`).

- **Course ID**:  
  The numeric identifier for the Moodle course you're working with. This is visible in the course URL as a segment like ``id=123``.

- **Assignment ID**:  
  If you're importing submissions, you'll also need the specific assignment ID, which appears similarly in the assignment URL.

- **Sufficient Permissions**:  
  The Moodle account used must be enrolled in the course as a teacher or non-editing teacher to access submissions and user data.

.. note::

   You can find course and assignment IDs by opening the respective pages in Moodle and checking the URL (e.g., ``.../course/view.php?id=123``).  
   If you're unsure about your API key or access level, contact your Moodle administrator.  
   For system administrators: see :ref:`moodle_admin_setup` for detailed instructions on configuring Moodle to enable API access.  

Setting Up the Moodle Integration in CARE
-----------------------------------------

To configure Moodle API access in the CARE platform:

1. Go to ``Settings`` in the sidebar
2. Select the ``RPC`` panel and then click on ``moodleAPI``
3. Enter the following:

   - rpc.moodleAPI.apiKey – your API key from the Moodle admin
   - rpc.moodleAPI.apiUrl – the base URL of your Moodle instance
   - rpc.moodleAPI.courseID – the course ID where you are assigned as a tutor or teacher

.. note::

   The Moodle account used must have proper permissions for the course. If you're unsure, ask your Moodle administrator for help.  

Using Moodle with the CARE Platform
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Importing Users**

Before using this feature, make sure Moodle API access is configured as described in :ref:`moodle_api_setup`.

User data can be imported from Moodle using the course ID:

1. In the Dashboard navigate to ``Users > Import via Moodle``
2. CARE will match users by email address

CARE handles three scenarios:

- New users are created if not found
- Duplicate users are merged based on email match
- Conflicts (e.g., mismatched emails) require manual correction

.. warning::

   Never delete a user with an ``extId`` unless you are certain it won't be needed. This could prevent future updates or synchronization.

.. tip::

   If a user's email in CARE differs from Moodle, edit it manually to allow a match. Avoid duplicates.

The CARE platform integrates directly with Moodle to help manage studies. Researchers typically use the following workflows:

**Importing Submissions from Moodle**

To collect assignment submissions:

1. In Moodle, create an assignment. See :ref:`assignment_config_moodle` for detailed configuration instructions.

2. In CARE:

      - In the Dashboard go to ``Submissions``
      - Choose ``Import via Moodle``
      - Provide the correct course and assignment IDs

.. tip::

   .. tip::

   After importing, close the import window using the ``X`` icon. Submissions will then appear in the ``Submissions`` section of the Dashboard.

**Study Creation with Imported Submissions**

To create a study:

1. In the Dashboard go to ``Studies > Add Single Assignment``
2. Choose a template or start from scratch.

   If you don’t have a template yet, you can create one by first building a custom study:

   - In the Dashboard, go to ``Studies``
   - Click on ``Add`` to create a new study
   - Define the workflow and settings as needed
   - After saving, your study will appear in the list
   - Click on ``Save as template`` to reuse this setup in future studies

3. Select the specific imported document you want to include in the assignment
4. Assign reviewers and finalize setup

**Publishing Feedback**

After analysis or review, you may want to send feedback to students:

1. Close your study in CARE.

   To do this, go to the ``Studies`` section in the Dashboard, locate your study in the list, and click the ``Close Study`` button.

2. In the Dashboard, go to ``Submissions`` and click on ``Publish Reviews``
3. Select the corresponding session and assignment
4. Use the ``Upload to Moodle`` option

.. warning::

   Feedback can only be published to users with a valid ``extId`` (external ID from Moodle). Missing IDs must be corrected via user re-import.

Assignment Configuration in Moodle
----------------------------------

Before configuring assignments, ensure your Moodle instance is set up correctly. See :ref:`moodle_api_setup`.

Depending on the task, configure assignments as follows:

**For collecting submissions:**

- ``Submission type``: ``File submissions``
- ``Feedback type``: ``Feedback comments``
- ``Submit button``: ``No``
- ``Submission statement``: ``Yes``

**For publishing feedback (no file uploads):**

- ``Submission type``: None
- ``Feedback type``: ``Feedback comments`` (Inline: ``No``)
- ``Grade type``: None
- ``Completion conditions``: None

Choose clear and descriptive assignment names for easier tracking in CARE.

Further Reading
---------------

For official and technical resources, consult:

- `Moodle Web Services API Documentation <https://docs.moodle.org/dev/Web_services>`_
- `Moodle Plugin Development Guide <https://moodledev.io/docs/apis/core/dml>`_

These references can provide additional context for permissions, supported functions, and integration behavior when needed.
