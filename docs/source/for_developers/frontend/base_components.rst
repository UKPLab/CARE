Base Components
=================

CARE comes with a range of easy-to-use and function rich base components that you can find under
``frontend/src/basic``. Using these components ensures a consistent design throughout the application
and makes your live as a developer so much easier.

In this brief chapter we outline the toolbox of basic components in a high-level fashion. For the details
of each base component, please refer to the documentation within each of them.

.. note::
    Also checkout the base components that are specifically discussed in this documentation. These comprise
    of the :doc:`icons <for_developers/frontend/icons>` and :doc:`loading <for_developers/frontend/loading>`
    components.

Card
-----
The card component offers a simple boostrap card with a title, body and footer. This is the go-to component
if you want to add information to dashboard components or in the annotator's sidebar.


Collaboration
-------------
Collaboration is a component that fully manages the synchronization necessary to realize collaborative features in
CARE. Simply import this component by a target type (e.g. a document) and id (e.g. the id of the document) to forward
a user's interaction to other clients (e.g. while editing an annotation).


Modal
-----
Import this component if you need a modal prompted to the user. You can customize the header, body and footer.

Table
-----
The table is the best way to visualize many rows of data. Simply pass the data rows to the table and specify the header.
Optionally, you may add button groups or selection boxes to each row. The table by default comes with a (frontend)
pagination feature and simple sorting for each column.

Downloading
-----------
The different downloading components offer an easy way to manage the download of individual data points. Import the
suitable download component and provide the socket messages and IDs you want to download; the component takes care
of acquiring this data and pushing the result to the parent component upon completion. Use the export components if
the downloaded data should be exported in the browser.
