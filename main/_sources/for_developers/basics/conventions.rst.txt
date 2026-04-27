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
Use this as a self-review before opening any PR. Reviewers use the same checklist.

General
~~~~~~~

- All open ``TODOs`` in the code are resolved or explicitly documented in an issue
- All :ref:`naming conventions <naming-conventions>` are fulfilled
    - No redundant or unused variables
    - Variable names are self-explanatory
- Lint: Code is adequately indented and readable
- All comments are correct, consistent, and free of spelling errors
- All functions are documented with JSDoc (parameters, descriptions, return types)
- No blocks of repeated code; extract shared logic into named functions
- No ``console.log`` calls left in — always use the integrated logger (check both backend terminal and browser console)

Backend — Sockets
~~~~~~~~~~~~~~~~~

- All socket handler methods are ``async``
- All socket handlers are registered using ``createSocket(eventName, handler, additionalOptions, useTransaction)``
- Socket classes never call Sequelize directly — always use ``MetaModel`` static methods or the model's own methods (``getById``, ``updateById``, ``add``, ``deleteById``, etc.)
- DB transactions are used whenever multiple dependent DB writes exist; pass ``options.transaction`` through all calls
- Side effects that must run after a commit (sending emails, triggering broadcasts) use ``options.transaction.afterCommit(() => ...)``
- ``userId`` is always taken from ``this.userId`` (server session) — never from ``data.userId`` or any other frontend-supplied value
- Permission checks are present and correctly scoped:

    - Admin-only operations call ``await this.isAdmin()``
    - User-owned resource operations call ``this.checkUserAccess(resource.userId)``
    - Right-based access calls ``await this.hasAccess('right.key')``
- Cross-socket calls use ``this.getSocket('SocketClassName')`` — no direct imports of other socket classes
- Cross-service calls use ``this.server.services['ServiceName']`` — no direct imports of service files
- Cross-RPC calls use ``this.server.rpcs['RPCName']`` — no direct imports of RPC files

Backend — Models
~~~~~~~~~~~~~~~~

- New models extend ``MetaModel`` and do not reimplement ``getById``, ``updateById``, ``add``, ``deleteById``, or ``getAutoTable`` unless there is a specific override reason
- Soft delete is always done via ``MetaModel.deleteById()`` — never a hard ``destroy()`` unless explicitly justified
- Models that should be visible to the frontend declare ``autoTable: true`` and define ``fields`` (the allowed update columns) and ``accessMap`` where applicable
- ``publicTable: true`` is only set on models that genuinely need to be readable without authentication
- All multi-step write flows (create + update, create + send email, copy chains) are wrapped in a single Sequelize transaction
- ``options.transaction`` is passed to every ``MetaModel`` call inside a transaction
- Sensitive fields (``passwordHash``, ``salt``, ``initialPassword``) are never returned to the frontend — use ``relevantFields(user)`` from ``utils/auth.js`` or verify the model's ``fields`` array excludes them

Frontend — Vue Style
~~~~~~~~~~~~~~~~~~~~

- Component names are multi-word without the ``.vue`` suffix (``AnnotationCard``, not ``Card``)
- All props have ``type`` and ``required`` defined
- ``v-for`` loops use ``:key="item.id"``
- ``v-if`` and ``v-for`` are never on the same element; use a wrapping ``<template>`` instead
- Component-scoped styling is used (``<style scoped>``)
- Computed properties are simple; complex derivations are split into multiple named computeds
- Component and element attribute order follows the `Vue style guide <https://vuejs.org/style-guide/rules-recommended.html>`_

Frontend — Data and State
~~~~~~~~~~~~~~~~~~~~~~~~~

- Components load their own data via the ``subscribeTable`` plugin
- Feature flags are read from the Vuex settings module: ``this.$store.getters['settings/getValue']('setting.key')``
- Permission checks use ``this.$store.getters['auth/checkRight']('right.key')`` — not direct ``isAdmin`` comparisons in templates
- Unused Vuex state, getters, and mutations are removed
- Loading states and error handling exist for all data fetched from the backend; users are informed when data is unavailable or still loading

Frontend — Structure and Imports
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Imports use the ``@`` path alias for anything outside the current or immediate sub-directory
- Base/shared components are reused for icons, buttons, tables, and modals — no custom reimplementations of existing base components

Documentation
~~~~~~~~~~~~~

- Documentation compiles without errors: ``make doc``
- New socket events, settings keys, and feature flags are documented
- Any new feature is described clearly enough for a developer unfamiliar with the area to implement a follow-up task

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