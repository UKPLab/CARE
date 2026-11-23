Backend integration tests
=========================

For fast frontend, backend, and shared-module checks, see
:doc:`the shared testing workflow <../testing>`.

The legacy Jest suite includes authentication, socket, and database tests under
``backend/tests``. Run it from the repository root:

.. code-block:: bash

    make test

.. warning::

   This command recreates the test database and applies its migrations.

Tests run sequentially. Authentication and socket tests start server instances;
database-only tests use the database directly. Server instances must use different
ports.
