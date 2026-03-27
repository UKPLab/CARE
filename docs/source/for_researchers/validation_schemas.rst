Validation Schemas
==================

CARE allows administrators and researchers to define custom validation schemas
that enforce specific file format requirements for submissions. This enables
project-specific or assignment-specific validation rules (e.g., "PDF + LaTeX ZIP" for exposés) 
to ensure submissions meet your study's requirements.

.. note::

   For developers working with the validation code, see :doc:`../for_developers/backend/validation`.

Overview
--------

Validation schemas are JSON configuration files that define:

- Which files are required in a submission
- File naming patterns (using regular expressions)
- ZIP archive content requirements
- Allowed additional file types

When users upload submissions, CARE validates them against the selected schema
before accepting them into the system. This prevents broken or incomplete
submissions and ensures consistent submission formats across your study.

Creating a Validation Schema
-----------------------------

A Validation schemas is structured as follows:

**Top-level attributes**

- ``version``: Schema version (e.g., ``"0.0.1"``)
- ``name``: Schema name (e.g., ``"UKP Exposé Submission Validator"``)
- ``description``: Description of this schema
- ``type``: Must be set to ``"validation"``
- ``rules``: Object containing validation rules (see below)

**Rules object**

- ``additionalFilesAreAllowed``: Boolean indicating if unspecified files are accepted
  at the root level. Set to ``false`` to enforce strict file requirements.
- ``requiredFiles``: A list of required file definitions (see below)

**Each** ``requiredFiles`` **entry supports**

- ``name``: Name identifier for this file type
- ``pattern``: Regex pattern matched against the filename (e.g., ``".*\\.pdf$"``)
- ``description``: Description of the file's purpose
- ``required``: Boolean indicating whether the file must be present
- ``includeFiles`` *(optional)*: A list of validation rules for ZIP archive contents
- ``allowAdditionalFiles`` *(optional)*: A list of allowed file extensions inside ZIP archives (e.g., ``["jpg", "png", "pdf"]``)

**ZIP validation rules inside** ``includeFiles``

- ``name``: Name identifier for this file
- ``pattern``: Regex pattern for ZIP entries (e.g., ``"Expose\\.tex$"``)
- ``description``: Description of the expected file
- ``required``: Boolean indicating whether the file must be present
- ``maxMatches`` *(optional)*: Maximum number of allowed matches

Example: PDF Only Validation
-----------------------------

**Goal:** Ensure a required PDF is present with no additional files.

.. code-block:: json

   {
     "version": "0.0.1",
     "name": "PDF Only Validator",
     "description": "Validates that exactly one PDF file is present",
     "type": "validation",
     "rules": {
       "additionalFilesAreAllowed": false,
       "requiredFiles": [
         {
           "name": "PDF",
           "description": "Main PDF document",
           "pattern": ".*\\.pdf$",
           "required": true
         }
       ]
     }
   }

Example: PDF + LaTeX ZIP Validation
------------------------------------

**Goal:** Require one PDF and one ZIP archive containing LaTeX sources with specific files.

.. code-block:: json

   {
     "version": "0.0.1",
     "name": "Exposé Submission Validator",
     "description": "Validation schema for Exposé LaTeX submissions",
     "type": "validation",
     "rules": {
       "additionalFilesAreAllowed": false,
       "requiredFiles": [
         {
           "name": "PDF",
           "description": "Main PDF of the Exposé",
           "pattern": ".*\\.pdf$",
           "required": true
         },
         {
           "name": "ZIP",
           "description": "Raw Latex Files for the Exposé",
           "pattern": ".*\\.zip$",
           "required": true,
           "allowAdditionalFiles": ["jpeg", "jpg", "png", "pdf", "bst", "cls"],
           "includeFiles": [
             {
               "name": "expose",
               "description": "Main expose LaTeX document",
               "pattern": "Expose\\.tex$",
               "required": true,
               "maxMatches": 1
             },
             {
               "name": "bibliography",
               "description": "Bibliography file for the exposé",
               "pattern": "ExposeBibliography\\.bib$",
               "required": true,
               "maxMatches": 1
             },
             {
               "name": "config",
               "description": "TUDa thesis configuration file",
               "pattern": "tudathesis\\.cfg$",
               "required": true,
               "maxMatches": 1
             }
           ]
         }
       ]
     }
   }

Uploading Validation Schemas
-----------------------------

Validation schemas can be uploaded via the Configuration Dashboard:

1. Log in to CARE with an admin account
2. Navigate to the **Configuration** section in the dashboard
3. Upload your validation schema JSON file
4. The schema will be available for selection during submission uploads

.. note::

   Default validation schemas are stored in the database via migrations.
   Example: ``backend/db/migrations/20250919125851-basic-configuration-expose_validation.json``

Validation Behavior
-------------------

The validator automatically handles several common scenarios:

- **System files**: Filters out system metadata files such as:
  
  - ``.DS_Store`` (macOS)
  - ``__MACOSX/`` (macOS metadata directory)
  - ``Thumbs.db``, ``desktop.ini`` (Windows)
  - Files starting with ``._`` (macOS resource forks)

- **ZIP folder structure**: If a ZIP contains a single top-level folder, this folder
  is automatically stripped during validation. Files must be located either at the ZIP
  root or within a single top-level directory.

- **Error reporting**: The validator stops at the first error encountered and reports
  it to the user. It does not exhaustively check all possible errors.

See Also
--------

- :doc:`../for_developers/backend/validation` (developer documentation for the validation system)
- ``backend/db/migrations/20250919125851-basic-configuration-expose_validation.json`` (example schema file)

