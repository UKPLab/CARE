Tests
=====

We provide a number of tests for the backend, including authentication and websocket tests.
The tests are located in the ``backend/tests`` directory.

You can run the tests with the following command:

.. code-block:: bash

    make test

The tests are using the `Jest <https://jestjs.io/>`_ testing framework.

Structure
---------

Before the test environment is set up, a special test instance of the database is recreated including all migrations available.
Afterwards, the test environment is set up and the tests are executed in a sequential order.
Each test file starts his own server instance, each test connects separately to the server instance with a new user instance.
The test environment is torn down after all tests are executed.

.. note::

    Please make sure that each server instance use another port.

Problem report coverage
-----------------------

Report backend tests follow the existing ``*.test.js`` convention and are
selected by ``make test``. Socket tests create and clean up their own user and
administrator fixtures instead of relying on the first-time setup wizard.
They exercise real database operations; UUID generation is substituted with
Node's random UUID generator, and the unrelated HTTP export router is isolated
from the socket suite to avoid unrelated ESM-loader requirements.

Frontend report tests also use ``*.test.js`` and run through the existing
``npm run test:unit`` command in ``frontend``. The backend's ``frontend.test.js``
adapter discovers all frontend ``.test.js`` and ``.test.mjs`` suites and runs them
with Node's native test runner, so ``make test`` includes them as well. They cover fixed snapshots,
consent changes, retries, cursor export under concurrent submissions and
CSV-to-ZIP attachment linkage. CI configuration and existing package scripts
are unchanged; a build/lint job does not itself execute these behavior suites.
