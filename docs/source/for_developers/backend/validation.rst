Validation
==========

CARE enables users to validate files, both uploaded directly and imported from
third-party platforms, before they are stored in the database. This validation
process prevents broken or incomplete submissions and enforces
project-specific format requirements (e.g., "PDF + LaTeX ZIP" for exposés).

.. note::

   A *submission* refers to the set of one or more files that are uploaded or imported together 
   for a specific assignment and it can only be accepted if a validation schema is defined 
   and the validation check succeeds.

This documentation describes the key components of the validation mechanism
and its practical use cases.

General Procedure
-----------------

1. The user selects a validation schema on the frontend.
2. Files are uploaded or fetched from Moodle.
3. On the backend, ``validator.js`` loads the configuration and validates files
   according to the selected schema.

   - **On success**: Files are saved and linked to a submission.
   - **On failure**: An error message is displayed to the user on the frontend.

.. note::

   Validation schemas can be uploaded by an admin via the Configuration Dashboard.


Key Components
--------------

The validation flow consists of three key components:

- **Validation Schema**: A JSON schema stored in the Configuration table that defines validation rules.
  For details on creating and configuring validation schemas, see :doc:`../../for_researchers/validation_schemas`.
- **Validator**: A utility class implemented in ``backend/utils/validator.js``. Handles file download and validation logic.
- **Frontend**: Users select a validation schema via the validator selector
  (see the ``ValidatorSelector`` component used in the dashboard submission flow).

.. note::

   Default validation schemas are stored in the database via migrations.
   Example: ``backend/db/migrations/20250919125851-basic-configuration-expose_validation.json``.


Validator Class
-------------------

The ``Validator`` class provides methods for validating submission files against
validation schemas. It handles file downloads from Moodle, file categorization,
and validation logic.

**Constructor**

.. code-block:: javascript

   const Validator = require("../../utils/validator.js");
   const validator = new Validator(server, models);

**Key Methods**

- ``downloadFilesToTemp(files, options)``: Downloads files from Moodle to temporary location
- ``validateSubmissionFiles(files, configId)``: Validates files against a schema
- ``categorizeFiles(files)``: Categorizes files by type (PDFs, ZIPs, others)

Usage Example
--------------

This example shows how the validator is used in practice as part of 
the submission import flow (e.g. in ``DocumentSocket``) .

**Goal:** Download submissions (optionally from Moodle), validate them against a
validation schema, and either create the submission or abort with an error.

**Steps:**

1. Instantiate the validator with ``server`` and ``models``.
2. (Optional) Download files to a temporary location (e.g. from Moodle).
3. Validate the temporary files using ``validateSubmissionFiles``.
4. On success, create the submission and related documents inside a transaction.
5. On failure, abort the transaction and report the error to the user.

.. code-block:: javascript

   //  1) Instantiate the validator.
   const Validator = require("../../utils/validator.js"); // path shown is for reference only
   const validator = new Validator(server, models);

   async function handleSubmission(submissionFiles, moodleOptions, configId, transaction) {
       // 2) (Optional) Download submissions from Moodle
       const tempFiles = submissionFiles
           ? await validator.downloadFilesToTemp(submissionFiles, moodleOptions)
           : files; // use already-uploaded files

       // 3) Validate files against the configured validation schema
       const result = await validator.validateSubmissionFiles(tempFiles, configId);
       if (!result.success) {
           // 5) Abort on failure
           throw new Error(result.message);
       }

       // 4) Proceed with creating the submission
   }

Error Handling Patterns
-----------------------

**Best practices:**

- Always check ``result.success`` and display ``result.message`` to the user.
- In batch imports, collect errors per submission while processing the rest.
- Wrap validation and database operations in a transaction and roll back on failure.

.. note::

   The validator does not exhaustively check all errors.  
   It stops at the first error encountered and reports it.


See Also
--------

- ``backend/utils/validator.js`` (implementation)
- ``backend/webserver/sockets/document.js`` (integration)
- :doc:`../../for_researchers/validation_schemas` (creating and configuring validation schemas)
- Frontend validator selector (dashboard submission flow)