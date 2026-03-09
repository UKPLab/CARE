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

Repository Workflows
--------------------

Issue Management
~~~~~~~~~~~~~~~~

--------

**Issues** are the central means of tracking tasks in this process. You should open an issue when

- you are fixing a bug in a stable branch (e.g. on development).
- you are making hot fixes (on the deployment branch).
- you are creating a new feature or part of a feature.

One issue can comprise multiple smaller tasks, but it should specify a development process that has clear intended value to the project. Typically, an issue is processed by a single developer.

git Workflows
-------------

--------

Overview
~~~~~~~~

This part explains the workflow for adding a new feature to the code base involving proper management of git branches and naming conventions. Please read this manual before making any changes to the code. We essentially stick to `this <https://nvie.com/posts/a-successful-git-branching-model/>`_ branching model for git.


Assumptions
~~~~~~~~~~~

You want to implement a new feature, realize a hot fix or make any other non-trivial change to the repository code. You created a summarizing issue of this feature/bug/release using one of the templates describing the details of what you plan to do and what the objective (testable) outcome is.

There are currently two main branches in the repository:

- `main`: holds only verified, stable and deployable code. Only major pull requests are added to this by repo maintainers. This branch is protected.
- `dev`: holds current, stable code under development. This branch may include experimental features etc. and is merged to `main` occasionally. This branch is protected.

General Guidelines
~~~~~~~~~~~~~~~~~~

**Branch naming**

- Child branches start with the name of their parent branch (excluding `main` and `dev` as parents) as a prefix, e.g.

::

    git checkout -b feat-FNUM-FNAME-CHILD feat-FNUM-FNAME

- Separate each part of the branch name by "-"

- Child names are short and expressive. If you created an extra issue for them, you should start with its number, e.g.

::

    git checkout -b feat-FNUM-FNAME-CHILDNUM-CHILDNAME feat-FNUM-FNAME

**Commit Messages**

Format: ``<type> : <short summary>``

Explanation of Each Part:

- ``<type>``: Indicates the category of change (e.g., feat, fix, docs).
- ``<short summary>``: A concise description of the change in the present tense.

**Rules**:

1. Concise and precise commit messages that describe what you have done.
2. Use the **present tense** (e.g., "add", not "added").
3. Use **lowercase** for ``<type>`` and the summary.
4. Describe **WHAT** the commit does, **not WHY**.
5. **Atomic commits** only: Each commit should represent a **single, small, self-contained change** instead of a list of unrelated changes.
6. **Rule-of-thumb**: A commit should cover code of at most one day of work.

General Example: ``fix: remove parameter "xyz"``

**Examples of Types**:

- ``feat``: A new feature
- ``fix``: A bug fix
- ``refactor``: A code change that neither fixes a bug nor adds a feature
- ``docs``: Documentation changes only
- ``test``: Adding tests or correcting existing tests
- ``style``: Changes that do not affect the meaning of the code (formatting, whitespace, etc.)
- ``ci``: Changes to CI configuration files and scripts
- ``chore``: Other changes (build tasks, dependencies, maintenance)
- ``other``: Use it in case nothing above fits your case (not recommended)

**Suggestive Verbs per Type**

.. list-table::
   :header-rows: 1

   * - Type
     - Suggestive Verbs
   * - feat
     - add, implement, introduce, create, enable, integrate
   * - fix
     - fix, resolve, patch, correct, repair, handle
   * - refactor
     - refactor, restructure, simplify, optimize, extract, consolidate
   * - docs
     - add, update, revise, clarify, document, remove
   * - test
     - add, update, fix, expand, cover, mock
   * - style
     - format, reformat, lint, clean, style, prettify
   * - ci
     - configure, update, fix, add, adjust, remove
   * - chore
     - update, bump, remove, clean, upgrade, configure

Instructions
~~~~~~~~~~~~

--------

**New feature**

You want to implement an entirely new feature, which is non-trivial to realize.

1. Any features are realized starting from the development branch. Switch to this branch for creating a child branch.

::

    git checkout dev

2. To create a new feature branch on `dev`, you first need to define a proper name. The feature has an associated issue number ``FNUM`` and a one-word name ``FNAME``. Then you create a child branch as:

::

    git checkout -b feat-FNUM-FNAME dev

3. Work on this branch. You may create arbitrary child branches as you see fit, but please stick to the general naming conventions (outlined above).

4. Push the branch and open a **Merge Request** into `dev`. Do **not** merge locally.

::

    git push -u origin feat-FNUM-FNAME
    # then open a Merge Request targeting 'dev'

5. After the MR is approved and merged, delete the branch via the platform option
   (“Delete source branch on merge”). Avoid manual deletions unless needed.

**Hot fixes**

The deployed version has a bug that needs to be fixed ad-hoc. There is an associated issue with an issue number.

1. Create a hot-fix branch from the main branch with issue number ``INUM``.

::

    git checkout main
    git checkout -b hotfix-INUM main

2. Realize the changes on this branch.

3. Push the branch and open a **Merge Request** into `dev`. It is reviewed by maintainers.

::

    git push -u origin hotfix-INUM
    # then open a Merge Request targeting 'main'

4. After the MR is merged, delete the branch via the platform option
   (“Delete source branch on merge”).