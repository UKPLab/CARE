Exporting Data
===================

In this chapter we cover the basics of exporting data for research, as well as the used data formatting.
Generally, there are two types of data that can be exported from CARE: the inline commentary data including
highlight texts, comment texts and metadata, as well as the behavioral user data including interaction with
certain UI elements, PDF page scrolling, comment revisioning etc.


Exporting Inline Commentary
---------------------------

How to export
~~~~~~~~~~~~~
In general, you can export all inline commentary data that

    * was created on a document that you uploaded (you are the owner)
    * was created by anyone including the NLP assistance replies
    * was created in studies or in regular reading mode
    * was *not* deleted
    * was *not* left in draft mode (never submitted after initial selection)

.. note::
    In the future, the data export feature will be extended to allow the configuration of which type of data should
    be exported including the export of draft or deleted annotations. If you need such annotations, you would
    currently need to access the "annotation" and "comment" table of the :doc:`database <../for_developers/backend/database>`.

To realize an export, you have two options:

    1. Access a document, press on the "..." button in the topbar on the right and click "Export annotations".
    2. In the dashboard Document component, press the button "Export all" at the top right of the documents table.

In case there are no inline commentary on the given documents, no data will be downloaded. In case of an error an
error message is prompted to the user.

Data format
~~~~~~~~~~~

The result of an export are one to two ``.json`` files for each documents. The hash in the downloaded file name indicates
the document, which is identical to the document URL. If the document has highlights, the first file ending in
``_annotations.json`` contains these highlights with associated comments and replies. If the document posses document
comments, i.e. comments unanchored to a span, a second file terminating in ``_notes.json`` is provided containing these
notes with all potential replies.

An example for the structure of the annotation export file looks as follows:

.. code-block:: javascript

    [
        {
        "text": "<highlighted span>",
        "id": 1,
        "documentId": 1,
        "createdAt": "2023-02-21T15:21:19.802Z",
        "updatedAt": "2023-02-21T15:21:21.478Z",
        "studySessionId": null,
        "userId": "guest",
        "tag": "Strength",
        "studyId": null,
        "comment": {
          "id": 1,
          "text": null,
          "documentId": 1,
          "createdAt": "2023-02-21T15:21:19.808Z",
          "updatedAt": "2023-02-21T15:21:21.481Z",
          "studySessionId": null,
          "userId": "guest",
          "tags": [],
          "annotationId": 1,
          "parentCommentId": null,
          "studyId": null,
          "replies": [
            ...
          ]
        }
      },
      ...
    ]

The comment field contains the top-level comment of an annotation, whereas the replies to that comment
are provided as a list under ``replies``. Each of the replies follows the same structure as the top comment,
hereby allowing for fully reply trees.


Data post-processing
~~~~~~~~~~~~~~~~~~~~

Depending on your use case, you should consider different filtering strategies.

**Filtering by study**
To get all annotations of a specific study, you can simply filter for the studyId:

.. code-block:: python

    # data holds list of parsed json objects
    # we are interested in the study with id 1
    study_annotations = [d for d in data if d["studyId"] == 1]


**Filtering by user**
To get all annotations of a specific user, you can simply filter by the userId field:

.. code-block:: python

    # data holds list of parsed json objects
    # we are interested in the study with id 1
    user_annotations = [d for d in data if d["userId"] == 1]


Exporting Behavioral User Data
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Behavioral user data is sensitive and therefore only accessible to administrators. To export this data after logging
in as admin to the system, simply access the "User Statistics" view of the dashboard an click on "Export all" on the
user table.

The resulting stats export structure is illustrated by the following example:

.. code-block:: javascript

    [
      {
        "id": 1,
        "action": "routeStep",
        "data": "{\"from\":\"/\",\"to\":\"/dashboard\"}",
        "userId": 1,
        "timestamp": "2023-02-23T15:57:08.693Z",
        "deleted": false,
        "deletedAt": null,
        "createdAt": "2023-02-23T15:57:08.693Z",
        "updatedAt": "2023-02-23T15:57:08.693Z"
      },
      {
        "id": 7,
        "action": "openUploadModal",
        "data": "{}",
        "userId": 1,
        "timestamp": "2023-02-23T15:57:33.065Z",
        "deleted": false,
        "deletedAt": null,
        "createdAt": "2023-02-23T15:57:33.065Z",
        "updatedAt": "2023-02-23T15:57:33.065Z"
      },
      {
        "id": 9,
        "action": "actionClick",
        "data": "{\"action\":\"accessDoc\",\"params\":{...}]}}",
        "userId": 1,
        "timestamp": "2023-02-23T15:57:48.734Z",
        "deleted": false,
        "deletedAt": null,
        "createdAt": "2023-02-23T15:57:48.734Z",
        "updatedAt": "2023-02-23T15:57:48.734Z"
      },
      {
        "id": 10,
        "action": "routeStep",
        "data": "{\"from\":\"/dashboard/documents\",\"to\":\"/document/...\"}",
        "userId": 1,
        "timestamp": "2023-02-23T15:57:49.446Z",
        "deleted": false,
        "deletedAt": null,
        "createdAt": "2023-02-23T15:57:49.446Z",
        "updatedAt": "2023-02-23T15:57:49.446Z"
      },
      {
        "id": 11,
        "action": "pdfPageVisibilityChange",
        "data": "{\"documentId\":2,\"readonly\":false,\"visibility\":{\"pageNumber\":1,\"isVisible\":true,\"offset\":17.5},\"studySessionId\":null}",
        "userId": 1,
        "timestamp": "2023-02-23T15:57:49.854Z",
        "deleted": false,
        "deletedAt": null,
        "createdAt": "2023-02-23T15:57:49.854Z",
        "updatedAt": "2023-02-23T15:57:49.854Z"
      },
      {
        "id": 14,
        "action": "annotatorScrollActivity",
        "data": "{\"documentId\":2,\"scrollTop\":510,\"scrollHeight\":2872}",
        "userId": 1,
        "timestamp": "2023-02-23T15:57:51.141Z",
        "deleted": false,
        "deletedAt": null,
        "createdAt": "2023-02-23T15:57:51.141Z",
        "updatedAt": "2023-02-23T15:57:51.141Z"
      },
      {
        "id": 15,
        "action": "pdfPageVisibilityChange",
        "data": "{\"documentId\":2,\"readonly\":false,\"visibility\":{\"pageNumber\":2,\"isVisible\":true,\"offset\":1436.5},\"studySessionId\":null}",
        "userId": 1,
        "timestamp": "2023-02-23T15:57:51.307Z",
        "deleted": false,
        "deletedAt": null,
        "createdAt": "2023-02-23T15:57:51.307Z",
        "updatedAt": "2023-02-23T15:57:51.307Z"
      },
      ...
    ]

Each interaction is associated with a type ``action`` and metadata ``data`` that fully describes the performed user
action at a point in time ``timestamp``. Based off of these traces, you can infer higher level event sequences and
analyze usage timings.

The most important action types include:

    * ``routeStep``: indicating the user navigated to a different route in the app, e.g. accessing a document
    * ``openModal``: indicating the user opened a modal of the type specified in the parameters
    * ``actionClick``: indicating the user clicked a button in a table with details of the button and table row
    * ``pdfPageVisibilityChange``: indicating that a page particular page was rendered or underendered on the user's screen.
      This is accompanied with a page number and the vertical offset of the page start to contextualize the next following action type.
    * ``annotatorScrollActivity``: indicating that a user scrolled within the PDF (provided in 500ms resolution) with a relative
      offset in the PDF.
