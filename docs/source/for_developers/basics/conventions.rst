Conventions and Paradigms
=========================

This document describes the conventions and paradigms that are used in the project.

.. _naming-conventions:

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

**Socket Function Documentation Style**

All socket methods in the backend must follow the JSDoc format shown below:

.. code-block:: javascript

    /**
     * The description of the method...
     * @param {Object} data - The input data from the frontend
     * @param {number} data.XXX - some description
     * @param {anotherType} data.OOO - some description
     * @param {Object} options - Additional configuration parameter
     * @param {Object} options.transaction - Sequelize DB transaction options
     * @returns {Promise<void>} // specify the return result is void if the method does not return anything
     * @throws {Error} - Describe when the error occurs and send the message back
     */

Use this template when adding or updating any socket functionality. This ensures that the interface is clear and standardized for all developers.

Code Review Guidelines
----------------------

The following checklist ensures consistency, quality, and maintainability across the codebase.
Reviewers should verify each item before approving changes.

General
~~~~~~~

- All open ``TODOs`` in the code handled
- All :ref:`naming conventions <naming-conventions>` are fulfilled

    - No redundant or unused variables
    - Variable names are self-explanatory
- Lint: Code is adequately indented and readable
- All comments properly (e.g., without spelling errors, consistent with the code)
- All functions are documented properly (e.g., parameters correctly defined, description understandable)
- Code structure adequate (e.g., no blocks of repeated code, no one-liners in functions)
- No ``console.log`` printouts (i.e., always use integrated logger for handling messages) – check console in backend and browser!

Backend
~~~~~~~

- All file handles in socket connection are async
- All functions documented
- All sockets are defined using :ref:`createSocket`
- All socket events that perform database changes set ``db_transaction: true`` (see :ref:`socket-db-transaction`)
- Socket classes do not call the DB directly (always use predefined functions in DB Models or ``MetaModel`` class – see ``./backend/db/models`` and ``./backend/db/MetaModel.js``)
- DB transactions are used if multiple DB calls are depending on each other
- MetaModel.js used for all possible functions
- Security: No ``userId`` is set from the frontend, backend ``this.userId`` is always used

Frontend
~~~~~~~~

- Complied with `Vue Styling Guidelines <https://vuejs.org/style-guide/>`_

        - Vue component names without ".vue" and multi-word
        - Use detailed prop definitions (e.g., type and required defined!)
        - ``v-for`` loops use ``:key="<>.id"`` attribute
        - No usage of ``v-if`` on the same element as ``v-for``
        - `Component-scoped styling <https://vuejs.org/style-guide/rules-essential.html#use-component-scoped-styling>`_ used
        - `Simple computed properties <https://vuejs.org/style-guide/rules-strongly-recommended.html#simple-computed-properties>`_ (i.e., no complex code in computes)
        - `Component/instance options order <https://vuejs.org/style-guide/rules-recommended.html#component-instance-options-order>`_ and `Element attribute order <https://vuejs.org/style-guide/rules-recommended.html#element-attribute-order>`_
        
- Check for stale variables and methods (e.g., remove unused functions and options)
- Imports use "@" in path (except for same or one-level sub-directory imports)
- Basic components are used (e.g., Icons, Buttons, Tables, etc.)
- Safeguards for loaded variables from backend are available (i.e., what happens if receiving a variable from backend fails or needs time – user needs to be informed!)
- Every component loads data it needs by itself (using the :ref:`DB subscription method <db-subscription-method>`) // TODO: Link to DB subscription method when ready

Documentation
~~~~~~~~~~~~~

- Documentation compiles without errors and is readable (i.e., ``make doc``)
- Documentation is clearly written and helps a `DAU <https://de.wikipedia.org/wiki/D%C3%BCmmster_anzunehmender_User>`_ to implement a feature