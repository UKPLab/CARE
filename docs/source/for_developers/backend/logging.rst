Logging
=======

Here is a little help on how the logging works and what should be taken into account during development to detect at any time if something goes wrong.

Logging framework: `Winston <https://github.com/winstonjs/winston>`_

How to log
----------

Central entry point of each logging is the file in the backend `./backend/utils/logger.js`.
This should generally be integrated into each file with adapting the **service-field** to allow an assignment of the log:

.. code-block:: javascript

    const logger = require("../utils/logger.js")("service");


Within the code all information can now be logged directly via the *logger* variable.
The logging levels are based on the `RFC5424 <https://datatracker.ietf.org/doc/html/rfc5424>`_ standard and can be used as followed:

.. code-block:: javascript

    logger.log('warn', "127.0.0.1 - there's no place like home");
    logger.log('error', "127.0.0.1 - there's no place like home");
    logger.info("127.0.0.1 - there's no place like home");
    logger.warn("127.0.0.1 - there's no place like home");
    logger.error("127.0.0.1 - there's no place like home");

See `Using Logging Levels <https://github.com/winstonjs/winston#using-logging-levels>`_ for more information.

.. role:: javascript(code)
   :language: javascript

.. note::

    For socket and service classes the logger is already integrated and can be used directly with :javascript:`this.logger`.

Where are the logs stored?
--------------------------

The logs are saved as a file, entered into the database, and also output to the console (if set in .env).
For this purpose the environment variables can be adjusted:

.. code-block:: bash

    # Logging
    LOGGING_PATH=./logs
    LOGGING_LEVEL=info
    LOGGING_ALLOW_FRONTEND=true

See the **.env** file in the root directory more information!

During logging, three files are created in the specified folder:


.. list-table::

    * - File
      - Description
    * - **activity.log**
      - Contains all logs (by app log level)
    * - **error.log**
      - Only errors are saved here.
    * - **complete.log**
      - Contains all logs (by log level ENV *LOGGING_LEVEL*)

In addition, all logs based on the environment variable *LOGGING_LEVEL* are entered into the database.

Logging with user information
-----------------------------

Currently, the database also supports logging with user information already contained in the database.
For this purpose, additional meta data must be added to the logger, for which there are two ways:

.. code-block:: javascript

    // Adding meta data directly during logging
    logger.info("Just a info message with user information", {user: <uid> });

    // or using a child logger
    const child_logger = logger.child({user: <uid>});
    child_logger.info("Just a info message with user information");

.. note::

    The User ID <uid> must exists in the database table user!

Logging through websocket
-------------------------

There is also the possibility to log information directly from the frontend through the websocket.
After that, logs can be easily emitted to the websocket in each vue component with:

.. code-block:: javascript

    this.$socket.emit('log', {level: 'info', message: 'Just a info message from the frontend!'})

.. note::

    For this the environment variable **LOGGING_ALLOW_FRONTEND** must be explicitly set to **true**!
