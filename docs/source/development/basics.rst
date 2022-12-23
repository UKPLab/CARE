Basics
======

If you want to contribute to the development of the project,
please read this section to get a quick overview of the build process.


Prerequisites
-------------

PEER is built upon Node.js and npm. You will need to install them before you can start developing.

You can download Node.js from https://nodejs.org/en/download/.
This will also install npm.

You also need Docker and docker-compose for building the containers.
Please install them according to the official documentation:

* `Docker <https://docs.docker.com/engine/installation/>`_
* `Docker Compose <https://docs.docker.com/compose/install/>`_


Development
-----------

For basic development, you can just run:

.. code-block:: bash

    make docker # starts the docker containers needed for development
    make init   # initializes the database
    make dev    # starts the development server (backend & frontend)

This will start the development server for the backend as well as the frontend.

.. note::

    When starting the application for the first time, you need to initialize the database!
    Please make sure you run `make init` before and also after cleaning the environment (`make clean`)!

Build Variants
--------------

For more advanced development, you need to understand the difference between the frontend and backend and how they interact.
See the :doc:`Architecture <./architecture>` section for more information.

Both, frontend and backend can be started separately.
The source code is located in the ``frontend`` and ``backend`` folder respectively.
The frameworks used for each component, can be found in :doc:`Frameworks <../development/frameworks>` section.

Frontend Development
~~~~~~~~~~~~~~~~~~~~

Since the development of the frontend is not possible without starting the backend,
the frontend development must always include the backend providing the database and the logic for data processing.
Therefore, we recommend using `make dev` as described above.
This allows hot-loading of the elements, meaning that elements are replaced without reloading the whole page when they are changed.
Furthermore, the source code is not compressed, which allows debugging directly in the browser.

.. tip::

    Another very helpful feature is the `Vue Devtools <https://devtools.vuejs.org/>`_ browser plugin supporting extended debugging.

.. note::

    Hot-loading does not apply to the backend.
    If changes are made in the backend, the service must be stopped and `make dev` executed again.

Anyway, it is possible to build the frontend in a minified code version without hot-loading:

.. code-block:: bash

    make dev-build-frontend

For more information about the frontend development, see the section `Frontend Development`_.

Backend Development
~~~~~~~~~~~~~~~~~~~

In contrast, it is possible to make the development in the backend independent from the frontend.
However, it should be noted that many functions interact with each other,
so often changes in the backend also involve the need to make changes in the frontend.

For a pure backend development, the frontend must first be built with:

.. code-block:: bash

    make dev-build-frontend

After that, the backend can be started with:

.. code-block:: bash
    make dev-backend

To shorten things, both commands can also be executed with `make dev-build` at once.
