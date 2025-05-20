Debugging
=========

During development it is often necessary to get some insights into the different aspects of the application.
Thereby, a few methods have been found to be very helpful in accelerating the programming process.
Some of them are already describe inside the other sections of this documentation, but here they are listed again for convenience.

General
-------

Within the Development Mode (i.e. when running ``make dev``), we enabled different debugging options supporting you in the development process.
For example, the backend will log everything to the console, and the frontend will not minify the code. Also, the frontend will automatically reload the page when you change the code (i.e., hot loading).
Furthermore, the debugging options for vue.js are enabled, such that you can use the vue.js devtools to inspect the application.

.. tip::

    Use console.log() to print out the values of variables and objects.
    To help you find the output in the console, you can use some kind of prefix, e.g. ``console.log("debugging output: ", myVar);``.
    Remember that logging in backend is displayed in your terminal, while logging in frontend is displayed in your browser console (i.e., Developer tools).


Browser Developer Tools
-----------------------

Most of the commonly used browser support debugging tools, such as the developer console, the network tab, and the vue.js devtools.
The developer console is a very powerful tool, which allows you to inspect the DOM, the CSS, and the JavaScript code.
In the following, we will describe some of the most useful features of the developer console.

Inspect Websocket Connection
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The websocket is used to communicate between the frontend and the backend. It is often necessary to inspect the websocket connection to see what data is sent and received between the frontend and the backend.
To do so, open the developer console and go to the network tab. Then, reload the page and at filter for ``websocket``.
The websocket connection should be listed there. Click on it to see the details.
On the ``Response`` tab, you can see the messages that are transmitted between the frontend and the backend.
Sometimes, it is necessary to reload the page again to see the messages.

Inspect Vue.js Components
~~~~~~~~~~~~~~~~~~~~~~~~~

The vue.js devtools are a very powerful tool to inspect the vue.js components.
If you have installed the vue.js devtools, you can open them by clicking on the ``Vue`` tab in the developer console.
There, you can see all the components that are currently loaded in the application, including the data and the computed properties of each component.

A very useful feature of the vue.js devtools is the ``Vuex`` module.
It allows you to inspect the state of the application, including the state of the different vuex modules.
Sometimes, it is necessary to reload the page again to see the vuex tab in the vue.js devtools.

Stopping open processes
-----------------------

Sometimes during development, the backend will throw an error, which is not handled by the application itself.
In that case, the backend will stop working but the process will not be terminated and a error message "Error: listen EADDRINUSE: address already in use :::3001" will be displayed in the terminal.
In such a case, you have to terminate the process manually in the system monitor.
To find the process, you can search for ``node`` in the system monitor.
If you are sure no other node process is running, you can also terminate the process by executing ``killall node`` in the terminal.


Importing a Production Database Locally
---------------------------------------

Sometimes you need the exact data that lives in the production system to reproduce or
diagnose a bug.  The workflow below shows how to **export** the production database and
static files, copy them to your workstation, and **restore** them for offline debugging.

.. _db-backup-export:

Export on the production server
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: shell

    # 1 – Find the running Postgres container
    docker ps | grep xyz                 # replace “xyz” with a unique part of the container name

    # 2 – Create the dump (Makefile target)
    make CONTAINER=xyz-postgres-1 backup_db

    # 3 – Inspect the dump folder
    ls -l db_dumps/

    # 4 – Prepare a non-root backup location
    sudo mkdir -p /opt/backups/xyz
    mkdir -p /opt/backups/xyz/$(date +%d-%m-%Y)/

    # 5 – Copy the dump and related files
    cp db_dumps/dump_dd-mm-yyyy_xx_yy_zz.sql \
       /opt/backups/xyz/dd-mm-yyyy/
    cp -r ./files /opt/backups/xyz/dd-mm-yyyy/

    # 6 – Final check before leaving the server
    ls -l /opt/backups/xyz/dd-mm-yyyy/

.. _db-backup-download:

Download to your local machine
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: shell

    # 1 – Create matching target folders
    mkdir -p ~/projects/xyz/db_dumps
    mkdir -p ~/projects/xyz/files

    # 2 – Download the dump
    scp username@yourServer.domain:/opt/backups/xyz/dd-mm-yyyy/dump_dd-mm-yyyy_xx_yy_zz.sql \
        ~/projects/xyz/db_dumps/

    # 3 – Download related files (LaTeX, PDFs, uploads, …)
    scp -r username@yourServer.domain:/opt/backups/xyz/dd-mm-yyyy/files/* \
        ~/projects/xyz/files/

.. _db-backup-restore:

Restore locally
~~~~~~~~~~~~~~~

From the **project root** (where the ``Makefile`` is located):

.. code-block:: shell

    make clean                        # drop any existing local database
    make docker                       # build & start the Postgres container
    make init                         # create empty tables / seed data
    make recover_db CONTAINER=xyz-postgres-1 \
                    DUMP=dump_dd-mm-yyyy_xx_yy_zz.sql

.. note::

   ``DUMP`` is **just the file name**, because the Makefile already prefixes
   it with ``db_dumps/``.  Adjust the container name if yours differs.

Restart services and start debugging
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: shell

    make docker
    make dev

Your local instance now runs with the freshest production data, so you can
reproduce bugs and test fixes without touching the live system.
