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

Code Review Guidelines
----------------------

The following checklist ensures consistency, quality, and maintainability across the codebase.
Reviewers should verify each item before approving changes.

General
~~~~~~~

- All open TODOs in the code handled
- All naming conventions are fulfilled

        - No redundant or unused variables
        - Variable names are self-explanatory

- Lint: Code is adequately indented and readable
- All comments properly (e.g., without spelling errors, consistent with the code)
- All functions are documented properly (e.g., parameters correctly defined, description understandable)
- Code structure adequate (e.g., no blocks of repeated code, no one-liners in functions)
- No console.log printouts (i.e., always use integrated logger for handling messages) – check console in backend and browser!

Backend
~~~~~~~

- All file handles in socket connection are async
- All functions documented
- All sockets defined in a try/catch block
- All sockets contain maximal four code lines inside the try block (i.e., if more, it needs a separate function!)
- Socket classes do not call the DB directly (always use predefined functions in DB Models or MetaModel class)
- DB transactions are used if multiple DB calls are depending on each other
- All sockets use acknowledgments as response message
- MetaModel.js used for all possible functions
- Security: No userId is set from the frontend, backend this.userId is always used

Frontend
~~~~~~~~

- Complied with Vue Styling Guidelines

        - Vue component names without ".vue" and multi-word
        - Use detailed prop definitions (e.g., type and required defined!)
        - v-for loops use :key="<>.id" attribute
        - No usage of v-if on the same element as v-for
        - Component-scoped styling used
        - Simple computed properties (i.e., no complex code in computes)
        - Component/instance options order and element attribute order
        
- Check for stale variables and methods (e.g., remove unused functions and options)
- Imports use "@" in path (except for same or one-level sub-directory imports)
- Basic components are used (e.g., Icons, Buttons, Tables, etc.)
- Safeguards for loaded variables from backend are available (i.e., what happens if receiving a variable from backend fails or needs time – user needs to be informed!)
- Every component loads data needed by itself (i.e., in mounted or better via fetchData options)

Documentation
~~~~~~~~~~~~~

- Documentation compiles without errors and is readable (i.e., make doc_sphinx)
- Documentation is clearly written and helps a DAU to implement a feature