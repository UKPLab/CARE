Working with the Moodle API
================

If you want to work with the Moodle API, please take a look at this document to get an overview of the API integration and how to use it.

General structue
----------------------

All Moodle API calls are made via an rpc call and thereofore run on a different docker container. The main.py file in the moodleAPI folder is responsible for the actual call to the Moodle API. 
The result is then returned to the socket and can be used in the frontend or saved to the database. Take a look at the rpc.rst to get an overview on how the rpc calls work and how to setup your own.

If you want to use the Moodle API from CARE, you need to follow a specific structure:

.. list-table:: Moodle API Integration
   :widths: 25 75
   :header-rows: 1

   * - Step
     - Description
   * - 1
     - Call from the frontend to the 'moodle socket' in the backend. You can also create your own socket by following the structure of the moodle socket.
   * - 2
     - From the socket a call to the 'moodle rpc' is made.
   * - 3
     - The 'moodle rpc' then makes a call to the main.py file, which is located in the 'moodleAPI' folder. 
   * - 4
     - In the main.py file, the actual call to the Moodle API is made.
   * - 5
     - The result is then returned to the socket.
   * - 6
     - Now you can use the result in the frontend or save it to the database.

Functions
----------------------
The following functions can by called from the frontend:

getUsersFromCourse
----------------------

.. function:: getUsersFromCourse(courseID, options)

    This method retrieves all users from a given course. It then creates a csv file, containing the user information: id, username, firstname, lastname, email and their roles in the course (e.g. student/tutor)

    :param courseID: This is the course id of the course you want to get the users from. You can get it from the URL of the course.
    :type param1: int
    :param options: This parameters holds the URL of the Moodle website and the API token.
    :type param2: dict
    :paramparam options.URL: The URL of the Moodle website.
    :type options.URL: str
    :paramparam options.API_KEY: The API token of the Moodle website.
    :type options.API_KEY: str
    :return: CSV file with the user information.
    :rtype: CSV 

    :raises ExceptionType: Explanation of the exception when it might be raised.
    :raises AnotherException: Another possible exception.

Example Usage
-------------

.. code-block:: python

    example_variable = method_name(param1, param2)

Notes
-----

- Additional details, if any.
- Special considerations, warnings, or performance notes.

getUsersFromAssignment
----------------------

.. function:: getUsersFromAssignment(courseID, assignmentID, options)

    This method retrieves all users from a given assignment. It then creates a csv file, containing the user information: id, username, firstname, lastname, email and their roles in the course (e.g. student/tutor)

    :param courseID: This is the course id of the course you want to get the users from. You can get it from the URL of the course.
    :type param1: int
    :param assignmentID: This is the assignment id of the assignment you want to get the users from. You can get it from the URL while looking at the assignment.
    :type param1: int
    :param options: This parameters holds the URL of the Moodle website and the API token.
    :type param2: dict
    :paramparam options.URL: The URL of the Moodle website.
    :type options.URL: str
    :paramparam options.API_KEY: The API token of the Moodle website.
    :type options.API_KEY: str
    :return: CSV file with the user information.
    :rtype: CSV 

    :raises ExceptionType: Explanation of the exception when it might be raised.
    :raises AnotherException: Another possible exception.

Example Usage
-------------

.. code-block:: python

    example_variable = method_name(param1, param2)

Notes
-----

- Additional details, if any.
- Special considerations, warnings, or performance notes.



.. note::

    On Windows, you can use the ``make`` command with the `GNU Make for Windows <http://gnuwin32.sourceforge.net/packages/make.htm>`_ package.
    On newer windows systems, simply use ``winget install GnuWin32.Make`` and make it executable with ``set PATH=%PATH%;C:/Program Files (x86)/GnuWin32/bin``.


Customizing Builds
------------------
Any commands for building components of CARE can be found in the top-most ``Makefile`` of the project.
To see a full list of available commands run:

.. code-block:: bash

    make help

Before running your first build commands, you may want to customize the environment variables for your specific needs.
The environment variables are completely managed in the ``.env`` files at the top-most directory.
For most parts, the default settings should work for you, but if you want to adapt ports and hosts these are the files to change.
Also note that the initial admin account and password are stored here in cleartext.

.env-files
~~~~~~~~~~~~~~

You need to adapt different env-files depending on whether you build for development (``.env``), for deployment
(``.env.main``), or for testing (``.env.test``).

To avoid manual sourcing of the environment files, e.g. for continuous development setups,
you can pass the ``ENV=...`` before a call to make:

.. code-block:: bash

    make ENV=test test-frontend

.. note::

    You should always change the password of the admin account, especially for deployment.
    Only run the service in a secure environment to avoid leakage of the password information from the environment files.

.. warning::

    If you make changes to these files, keep in mind that some parameters are written directly to the database
    and may need a reinitialization of the database (e.g., admin password) if changed there. The database therefore loses all data!
    To reinitialize the database, run ``make clean`` followed by ``make init``.


Special Flags
~~~~~~~~~~~~~~

The following flags are relevant to configure the functionality of the built CARE instance and should be adapted
according to your needs.

.. list-table:: Environment Variables
   :widths: 25 75
   :header-rows: 1

   * - Flag
     - Meaning
   * - ``NLP_USE``
     - Set to ``true`` to connect the backend to the NLP Broker; we recommend ``false`` if you couple no NLP models.
   * - ``LOGGING_ALLOW_FRONTEND``
     - Set to ``true`` if log messages sent from a client frontend should be stored in the DB; we recommend ``true``.
   * - ``PUBLISH_DOC``
     - Set to ``1`` if your local CARE documentation should be published on your server.
   * - ``PUBLISH_API``
     - Set to ``1`` if the documentation for the CARE API should be published on your server.

.. note::

    After changes to the ``.env`` configuration files, you need to restart your server by running the build commands
    again.

|

Development Build
-----------------

The development build consists of two individual components -- the frontend and the backend -- which can be build
and run jointly or separately. For more advanced development, you need to understand the difference between the frontend
and backend and how they interact.
The frameworks used for each component, can be found in the :doc:`Frameworks <../for_developers/basics/frameworks>` section.
The source code is located in the ``frontend`` and ``backend`` folder, respectively.

Check out the following build options depending on your needs:

Basic
~~~~~~
If you are not sure what kind of build you want and possibly make changes both in the frontend and
the backend, just run the basic build using the following commands in different consoles and the given order:

.. code-block:: bash

    make docker # starts the docker containers needed for development
    make init   # initializes the database
    make dev    # starts the development server (backend & frontend) - only linux!

This will start the development server for the backend as well as the frontend. This also starts up
a database in a docker container and populates it with the necessary schemas.

.. note::

    When starting the application for the first time, you need to initialize the database!
    Please make sure you run ``make init`` before and also after cleaning the environment with ``make clean``!

.. warning::

        The ``make dev`` command only works on Linux systems.
        On Windows, you need to start the frontend and backend separately with ``make dev-frontend`` and ``make dev-backend``.

Frontend
~~~~~~~~~~~~

Since the development of the frontend is not possible without starting the backend,
the frontend development must always include the backend providing the database and the logic for data processing.

The frontend development allows hot-loading of the elements, meaning that elements are replaced without reloading or
reinitializing the page when they are changed. Furthermore, the source code is not compressed, which allows debugging directly in the browser.

To start the frontend development, run the following command:

.. code-block:: bash

    make dev-frontend

Anyway, it is possible to build the frontend in a minified code version without hot-loading:

.. code-block:: bash

    make dev-build-frontend

For more information about the frontend development, see the section :doc:`Frontend Development <../for_developers/frontend/frontend>`.

.. tip::

    Another very helpful feature is the `Vue Devtools <https://devtools.vuejs.org/>`_ browser plugin supporting extended debugging.


Backend
~~~~~~~~~

In contrast, it is possible to make the development in the backend independent from the frontend.
However, it should be noted that many functions interact with each other,
so often changes in the backend also involve the need to make changes in the frontend.

For a pure backend development, the frontend must first be built with:

.. code-block:: bash

    make dev-build-frontend

After that, the backend can be started with:

.. code-block:: bash

    make dev-backend

To shorten things, both commands can also be executed with ``make dev-build`` at once.

|

Deployment Build
----------------
If you want to deploy your current CARE code, please double-check the ``.env.main`` file to make sure it meets your
needs. For a deployment build simply run the following command to create a docker container (name ends with ``_main``),
start it and detach it from your terminal.

.. code-block:: bash

    make build   # creates docker container

.. warning::
    For actual deployment, we heavily recommend running an `NGINX <https://www.nginx.com/>`_ in front of the actual
    backend. See :doc:`../getting_started/installation` for instructions how to use it.

You can check the status and logs of the docker containers using the standard Docker CLI or
`Portainer <https://www.portainer.io/>`_. The container with the name ending in ``_server`` hosts the actual
backend.

|

More Commands
-------------

.. list-table:: Make Commands
    :widths: 60 40
    :header-rows: 1

    * - Command
      - Purpose
    * - ``make doc``
      - Compile the documentation (AsyncAPI and Sphinx documentation).
    * - ``make doc_asyncapi``
      - Compile the AsyncAPI documentation.
    * - ``make doc_sphinx``
      - Compile the Sphinx documentation (this documentation).
    * - ``make init``
      - Initialize the database (creating tables from backend migrations)
    * - ``make test``
      - Running the backend api tests.
    * - ``make backup_db CONTAINER=<name>``
      - Creates a database dump from the given postgres container and stores it in the db_dumps folder.
    * - ``make recover_db CONTAINER=<name> DUMP=<path>``
      - Loads a given database dump from <path> into the postgres container <name>.
    * - ``make clean``
      - Cleans the environment by removing all docker containers and images, files and folders.
    * - ``make kill``
      - Kills all node processes. (only unix)
    * - ``make lint``
      - Runs the linter for the frontend.

