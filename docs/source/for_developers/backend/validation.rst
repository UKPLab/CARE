Validation
==========

CARE enables users to validate files, both uploaded directly and imported from
third-party platforms, before they are stored in the database. This validation
process prevents broken or incomplete submissions and enforces
project-specific format requirements (e.g., "PDF + LaTeX ZIP" for exposés).

This documentation describes the key components of the validation mechanism
and its practical use cases.

General Procedure
-----------------

1. The user selects a validation schema (validation configuration ID) on the frontend.
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

- **Configuration Schema**: A JSON schema stored in the Configuration table that defines validation rules.
- **Validator**: Implemented in ``backend/utils/validator.js``. Handles download and validation logic.
- **Frontend**: Users select a validation schema via the validator selector
  (see the ``ValidatorSelector`` component in the dashboard submission flow).

.. note::

   Default configuration schemas are stored in the database via migrations.
   Example: ``backend/db/migrations/20250919125851-basic-configuration-expose_validation.json``.


Configuration Schema
--------------------

Validation configurations are JSON objects containing metadata and validation
rules.

**Top-level attributes**

- ``version``: Schema version  
- ``name``: Configuration name  
- ``description``: Description of this configuration schema  
- ``type``: Must be set to ``validation``  

**Rules object**

- ``additionalFilesAreAllowed``: Boolean indicating if unspecified files are accepted
  at the root level.
- ``requiredFiles``: A list of required file definitions.

**Each ``requiredFiles`` entry supports**

- ``pattern``: Regex pattern matched against the filename  
- ``description``: Description of the file’s purpose  
- ``required``: Indicates whether the file must be present  
- ``includeFiles`` *(optional)*: Validation rules for ZIP archive contents  
- ``allowAdditionalFiles`` *(optional)*: List of allowed file extensions inside ZIP archives  

**ZIP validation rules inside ``includeFiles``**

- ``pattern``: Regex pattern for ZIP entries  
- ``description``: Description of the expected file  
- ``required``: Whether the file must be present  
- ``maxMatches``: Maximum number of allowed matches  

// TODO: Need to rewrite this.
The validator automatically filters out system files (such as ``.DS_Store`` and
``__MACOSX/``) and enforces root-level file placement. If a ZIP contains a single
top-level folder, this folder is automatically stripped during validation.

Usage Examples
--------------

Basic Usage (PDF only)
~~~~~~~~~~~~~~~~~~~~~~

**Goal:** Ensure a required PDF is present with no additional files.

**Steps:**

1. Instantiate the validator with ``server`` and ``models``.
2. Call ``validateSubmissionFiles(files, validationConfigurationId)``.
3. If ``success`` is true, proceed to save the submission.

.. code-block:: javascript

   const Validator = require("../../utils/validator.js");
   const validator = new Validator(server, models);
   const result = await validator.validateSubmissionFiles(files, configId);
   if (!result.success) throw new Error(result.message);


Advanced Usage (ZIP with LaTeX)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Goal:** Require one PDF and one ZIP archive containing LaTeX sources.

**Configuration example:**  
``backend/db/migrations/20250919125851-basic-configuration-expose_validation.json``

**Validation behavior:**

- **PDF**: Required  
- **ZIP archive**: Required and must contain:
  
  - ``Expose.tex``
  - ``ExposeBibliography.bib``
  - ``tudathesis.cfg``

- **Additional ZIP files**: Limited to specific extensions (e.g., ``jpg``, ``png``, ``pdf``, ``bst``, ``cls``)


Integration with DocumentSocket
-------------------------------

The validator integrates into methods such as
``downloadMoodleSubmissions()`` and ``uploadSingleSubmission()`` found in
``DocumentSocket``.

**Validation flow:**

1. Download submissions from Moodle (if applicable).  
2. Validate files using ``validateSubmissionFiles``.  
3. **On success**: Create the submission and associated documents within a database transaction.  
4. **On failure**: Roll back the transaction and report the error to the user.  
   Progress updates are sent to the client throughout the process.


Error Handling Patterns
-----------------------

**Best practices:**

- Always check ``result.success`` and display ``result.message`` to the user.
- In batch imports, collect errors per submission while processing the rest.
- Wrap validation and database operations in a transaction and roll back on failure.

// TODO: Need to rewrite this.
.. note::

   The validator does not exhaustively check all errors.  
   It stops and reports the first encountered error.


See Also
--------

- ``backend/utils/validator.js`` (implementation)
- ``backend/webserver/sockets/document.js`` (integration)
- ``backend/db/migrations/20250919125851-basic-configuration-expose_validation.json`` (example schema)
- Frontend validator selector (dashboard submission flow)