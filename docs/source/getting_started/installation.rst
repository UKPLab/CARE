Installation
============

Follow the instructions to install our software:

Prerequisites
*************

Docker and docker-compose are required for build the containers.
Please install them according to the official documentation:

* `Docker <https://docs.docker.com/engine/installation/>`_
* `Docker Compose <https://docs.docker.com/compose/install/>`_


Build
*****

Before building the containers, you can change the basic configuration in the ``.env`` file.
To build the containers, run the following command:

.. code-block:: bash

    $ make build

This command will build the containers.

The application should be available at http://localhost:8080

.. note::

    The credentials for the admin user can be found in the .env file!
