Testing
=======

Run the fast frontend, backend, and shared-module checks from the repository root:

.. code-block:: bash

    make test-unit

This includes frontend unit/component tests, backend unit tests, and the
``editor-delta-conversion``, ``assessment-score``, and ``placeholder-tokens`` modules.
Run before and after changes. For a bug fix, confirm a reproducing test fails
before the fix and passes afterward. Review expected results and commit tests
with the code.

Add tests
---------

.. list-table::
   :header-rows: 1

   * - Tests
     - Folder
     - File names
   * - Frontend logic
     - ``frontend/tests/unit/``
     - ``*.test.js``
   * - Frontend components
     - ``frontend/tests/component/``
     - ``*.test.js``
   * - Backend units
     - ``backend/tests/unit/``
     - ``*.test.js`` or ``*.spec.js``
   * - Shared modules
     - ``utils/modules/<module>/tests/``
     - ``*.test.js``

Matching files are discovered recursively; no filename needs to be added to the
test command.

Reports (optional)
------------------

.. code-block:: bash

    npm run test:unit:ci --prefix frontend
    npm run test:unit:ci --prefix backend

These rerun the same tests and save results and coverage under
``frontend/coverage/unit/`` and ``backend/coverage/unit/``. Keep generated reports
out of commits. CI uploads available reports as ``unit-test-reports``.

Cautions and limitations
------------------------

- Use ``make test-unit`` with a hyphen. ``make test`` recreates the test database;
  see :doc:`backend/testing`.
- Database/RPC integration and real-browser behavior require separate checks.
- Frontend tests use Node's runner. Vite aliases, TypeScript, and ``.vue`` imports
  are not transformed automatically; follow the existing component-test setup.
- Coverage records execution, not assertion quality. Current frontend percentages
  include test files and lack reliable ``.vue`` line coverage; they do not measure
  the entire frontend.
