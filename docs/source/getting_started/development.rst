Development
===========

If you want to contribute to the development of the project, please follow the steps below.

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

PEER supports different variants to develop the project.

For basic development, you can just run:

    make docker # starts the docker containers needed for development
    make dev    # starts the development server (backend & frontend)

This will start the development server for the backend as well as the frontend.

.. note::

    For the first time you start the application, you need to initialize the database.
    With `make init` the database will be initialized with the default data.
    The docker container must be running for this command to work.
    Also after cleaning the environment with `make clean` you need to run `make init` again.

Further Variants
----------------

For more advanced development, you need to understand the difference between the frontend and backend and how they intertact.
See the `Architecture`_ section for more information.

Both, frontend and backend can be started separately.
The source code is located in the ``frontend`` and ``backend`` folder respectively.
The frameworks used for each, can be found in `Frameworks`_ section.

Frontend Development
~~~~~~~~~~~~~~~~~~~~

Since the development of the frontend is not possible without starting the backend,
the frontend development always includes the backend which provides the database and the logic for data processing.
Therefore, it is good practice to use `make dev`.

This also allows hot-loading of the elements, meaning that elements are replaced without reloading the whole page when they are changed.
Furthermore, the source code is not compressed, which allows debugging directly in the browser.
Another very helpful feature is the `Vue Devtools <https://devtools.vuejs.org/>`_ browser plugin supporting extended debugging.

.. note::

    This does not apply to the backend, if changes are made, the backend must be restarted!

Anyway, it is possible to build the frontend with minified code and without hot-loading with:

    make dev-build-frontend

For more information about the frontend development, see the section `Frontend Development`_.

Backend Development
~~~~~~~~~~~~~~~~~~~

In contrast to the frontend it is possible to make the development in the backend independent from the frontend.
However, it should be noted that many functions interact with each other,
which is why often changes in the backend also involve the need to make changes in the frontend.

For a pure backend development, the frontend must first be built with:

    make dev-build-frontend

After that, the backend can be started with:

    make dev-backend

To shorten this, both commands can also be executed with `make dev-build` at once.
