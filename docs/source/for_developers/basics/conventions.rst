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

- All ``TODO`` comments are addressed or justified.
- Descriptive and consistent naming conventions are followed.
- No unused or redundant variables.
- Variable and function names are self-explanatory.
- Code is properly indented and readable (passes linter).
- Comments are meaningful, correctly spelled, and aligned with the code.
- Functions are documented with correct parameters and clear descriptions.
- Avoid repeated code blocks and unnecessary one-liners.
- No ``console.log`` printouts — use the integrated logger in both frontend and backend.

Backend
~~~~~~~

- All socket methods use ``async/await`` and are documented.
- All socket handlers are wrapped in ``try/catch`` blocks.
- Maximum of four logic lines inside a ``try`` block — use helper methods if more needed.
- No direct database access from socket classes — use DB models or ``MetaModel.js``.
- Use database transactions for multiple dependent DB calls.
- All socket methods use acknowledgment (callback) responses.
- ``MetaModel.js`` is used when applicable.
- Security: ``userId`` is never passed from the frontend; use ``this.userId`` in the backend.

Frontend
~~~~~~~~

- Complies with the `Vue Style Guide <https://vuejs.org/style-guide/rules-essential.html>`_.
- Component names are multi-word and do not include ``.vue``.
- Props are defined with ``type`` and ``required`` attributes.
- ``v-for`` loops include a unique ``:key`` (e.g., ``:key="item.id"``).
- Avoid using ``v-if`` on the same element as ``v-for``.
- Scoped styles are used inside components.
- Computed properties remain simple and efficient.
- Component options and element attributes follow recommended order.
- Unused variables, props, and methods are removed.
- Imports use ``@`` aliases unless importing siblings or subfolders.
- Use base components (e.g., ``BasicButton``, ``BasicTable``, ``BasicIcon``).
- Ensure safe handling of asynchronous or missing backend data.
- Each component is responsible for loading its required data (in ``mounted`` or ``fetchData``).

Documentation
~~~~~~~~~~~~~

- Documentation builds without warnings or errors (e.g., using ``make doc_sphinx``).
- Content is written in clear, understandable English.
- Instructions should be accessible for non-technical users (DAU-friendly).