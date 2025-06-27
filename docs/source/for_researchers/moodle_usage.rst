Moodle API for Researchers
==========================

This guide provides an overview of how to interact with the Moodle API, including how to access, use, and integrate Moodle data in studies.

.. note::

   This documentation is meant for researchers and non-developers. If you're a developer working with the backend or extending RPC functionality, refer to the :doc:`Moodle API technical guide <../for_developers/backend/rpcs/moodle>`.

Overview
--------

The Moodle API enables authorized users to connect to a `Moodle Instance <https://moodle.org/>`_ and access course-related data. Researchers typically use this functionality to:

   - Import student submissions for annotation or evaluation
   - Distribute study results or feedback
   - View or manage course participation data

.. warning::

   Do not use the Moodle API to handle personally identifiable information (PII) unless this is explicitly permitted by your institution and approved by your research ethics committee.

Access Requirements
-------------------

To use the Moodle API, you will need the following:

- **API Key**: Issued by the Moodle system administrator.
- **API URL**: The base URL of your Moodle instance.
- **Course ID**  and **Assignment ID**: Numeric identifiers available in the Moodle URL.

.. tip::

   To find the course or assignment ID, open the corresponding page in Moodle. The URL will contain a segment like ``id=123``, which indicates the ID.

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

The Moodle account used must have proper permissions for the course. Ask your Moodle administrator for help if unsure.

Using Moodle with the CARE Platform
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The CARE platform integrates directly with Moodle to help manage studies. Researchers typically use the following workflows:

**Importing Submissions from Moodle**
To collect assignment submissions:

1. In Moodle, create an assignment with:

      - Submission type: ``File submissions``
      - Feedback type: ``Feedback comments``

2. In CARE:

      - Go to ``Review Documents``
      - Choose ``Import via Moodle``
      - Provide the correct course and assignment IDs

.. tip::

   After importing, close the import window using the ``X`` icon. Submissions will then appear in the ``Review Documents`` section. If multiple files are submitted by a student, CARE allows you to select the relevant file during study creation.

**Study Creation with Imported Submissions**
To create a study:

1. Go to ``Studies > Add Single Assignment``
2. Choose a template or start from scratch
3. Select the imported documents
4. Assign reviewers and finalize setup

.. tip::

Use clear names for studies and templates to distinguish multiple sessions.

**Publishing Feedback**
After analysis or review, you may want to send feedback to students:

1. Mark your study in CARE as ``Finished``
2. Go to ``Review Documents > Publish Reviews``
3. Select the corresponding session and assignment
4. Use the ``Upload to Moodle`` option

.. warning::

   Feedback can only be published to users with a valid ``extId`` (external ID from Moodle). Missing IDs must be corrected via user re-import.

Importing Users
~~~~~~~~~~~~~~~

User data can be synchronized from Moodle using the course ID:

1. Navigate to ``Users > Import via Moodle``
2. CARE will attempt to match users by email address

CARE handles three scenarios:

- New users are created if not found
- Duplicate users are merged based on email match
- Conflicts (e.g., mismatched emails) require manual correction

.. warning::

   Never delete a user with an ``extId`` unless you are certain it won't be needed. This could prevent future updates or synchronization.

.. tip::

   If a user's email in CARE differs from Moodle, edit it manually to allow a match. Avoid duplicates.

Assignment Configuration in Moodle
----------------------------------

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

Ethical Considerations
----------------------

When conducting research using the Moodle API:

- Minimize use of personally identifiable data
- Always adhere to your institution’s ethics guidelines
- Use anonymized or aggregated results where possible

.. caution::

      Improper handling of data may violate data protection regulations such as the `General Data Protection Regulation (GDPR) <https://gdpr.eu/>`_.

Further Reading
---------------

For official and technical resources, consult:

- `Moodle Web Services API Documentation <https://docs.moodle.org/dev/Web_services>`_
- `Moodle Plugin Development Guide <https://moodledev.io/docs/apis/core/dml>`_

These references can provide additional context for permissions, supported functions, and integration behavior when needed.
