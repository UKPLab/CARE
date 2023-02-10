Installation
============

To get started quickly, follow the below instructions. For a complete overview on you building, development and
deployment options checkout the :doc:`Before You Start <for_developers/before_you_start>` option. If you simply
want to run a user or annotation study, follow this guide.

Prerequisites
-------------

Docker and docker-compose are required to build the containers.
Please install them according to the official documentation:

* `Docker <https://docs.docker.com/engine/installation/>`_
* `Docker Compose <https://docs.docker.com/compose/install/>`_

Also make sure that you have GNU's ``make`` installed on your system.

Build
-----

Before building the containers, you can change the basic configuration in the ``.env`` file.
To build the containers, run the following command:

.. code-block:: bash

    $ make build

This command will build the containers.

The application should be available at http://localhost:8080

.. note::

    The credentials for the admin user can be found in the .env file!
