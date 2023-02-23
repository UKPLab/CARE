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