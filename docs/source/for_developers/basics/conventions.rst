Conventions and Paradigms
=========================

This document describes the conventions and paradigms that are used in the project.

Coding Conventions
----------------------
We follow the `Java Script Coding Style <https://javascript.info/coding-style>`_ for most parts of the project.
For the frontend we employ the `Vue Style Guidelines <https://vuejs.org/style-guide/rules-essential.html>`_.

Documentation
-------------
All methods and classes must be documented.
We use `JSDoc <https://jsdoc.app/>`_ for this purpose.
The documentation must be written in English.

Architectural Paradigms
-----------------------

*   Keeping services lean and simple
*   Extend already defined classes and use already defined methods whenever possible

Communication Paradigms
-----------------------

For the socket communication we follow the following conventions:

*   All messages are JSON objects.
*   All events use the `camelCase <https://en.wikipedia.org/wiki/Camel_case>`_ naming convention.
*   All events are prefixed with the name of the service that emits the event, followed by the action that is performed.
    For example, the event to refresh document data to the client ``documentRefresh``.
*   Additional specifier can be added to the event name, if necessary.
    For example, the request of an annotation by a user ``annotationGetByUser``.

Additionally, all socket events defined in the Backend must be surrounded by a try-catch block.
Inside the try block, maximum four lines of code should be executed. If more lines are necessary,
an additional method should be created and documented.