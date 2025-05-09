Sockets
==============================

There might be rare occasions where you need to extend the existing socket interface; e.g. after adding a new database
table to CARE and you want to make this data available to the frontend. In this chapter we outline the steps necessary
for either extending an existing socket or creating an entirely new one.

.. note::

    Please also see the code conventions for the socket interface in :doc:`Code Conventions <../basics/conventions>`

Sockets in CARE
---------------
The socket architecture is realized in the backend; in the following all paths are provided relative to the
directory ``backend/webserver`` including all relevant components.

During start-up of the webserver all sockets specified in the ``sockets`` directory that extends the ``Socket`` base class are loaded.
Each socket is specified in an individual ``.js``-file exporting a class that extends the ``Socket`` base class. Hence, adding
a socket means creating such a new file and overriding the abstract class.

This base class (specified in ``Socket.js``) defines several convenience methods to communicate with the frontend, as
well as attributes and methods to interact with the web server class starting the respective socket. In the following
sections we elaborate which methods and attributes you should use or override to realize your own service.

Conceptually, a socket class encapsulates a socket-io connection established by the webserver, which you can use to
listen to certain messages and which you can use to send back messages. For each frontend client that connects to the
webserver, all socket classes are instantiated anew having an associated client id. This means, all messages you send
and receive via the `socket` attribute are always specific to this *one* client connection; in other words,  there is no
state transfer between different connections or broadcasting possible. However, some of this functionality is made
available through the `server` object -- we address these options in the `Extending a Socket`_ section below.


Creating a Socket
-----------------
Let's say we want to add a new socket called ``TestSocket`` to CARE. First, we add a new file ``test.js`` to the
``backend/webserver/sockets`` directory that exports the new socket class:

.. code-block:: javascript

    const Socket = require("../Socket.js");
    /**
     * <doc>
     */
    module.exports = class TestSocket extends Socket {
        constructor(server, io, socket) {
            super(server, io, socket);
        }
    }

While this would already add the socket automatically to CARE on restart of the webserver, you should always override
the ``init()`` method of the base class. Here, you will add the message listeners; for now, we will just log that the
socket has been initialized.

.. code-block:: javascript

    /**
     * HEADER BOILERPLATE...
     */
    module.exports = class TestSocket extends Socket {
        constructor(server, io, socket) {
            super(server, io, socket);
        }

         init() {
            this.logger.debug(`TestSocket was created for client ${this.socket.id}`);
         }
    }

In the next section we elaborate on how to populate a socket by message listeners and response functionality.

Extending a Socket
------------------
Let's assume we want to extend a socket ``TestSocket`` defined in ``backend/webserver/sockets/test.js``. Generally,
socket logic should be kept lean and easy. The primary responsibility of a socket is to forward a new client request
to another module for processing (e.g. the database interface), handle possible errors and send the results back to
the client. In the following we explain the possible use-cases for extending a socket

Listening to a New Message Type
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Let's say we want to listen to new message types ``testIncrement`` and ``testReset`` that provides a data object parameters.
For the sake of brevity we do not interact with the database, but write to a class attribute.

.. code-block:: javascript

    /**
     * HEADER BOILERPLATE...
     */
    module.exports = class TestSocket extends Socket {
        constructor(server, io, socket) {
            super(server, io, socket);

            this.testVar = 0;
        }

        /* ... */

        // method for updating the variable
        updateTestVar(newVal){
            this.testVar = newVal;
            return this.testVar;
        }

        init() {
            /* ... */

            // listen to testIncrement
            this.socket.on("testIncrement", (data) => {
                try {
                    this.socket.emit("testResult", {success: true, val: this.updateTestVar(this.testVar + data.inc)});
                } catch (e) {
                    this.logger.error(e);
                }
            });

            // listen to testReset
            this.socket.on("testReset", () => {
                try {
                    this.socket.emit("testResult", {success: true, val: this.updateTestVar(0)});
                } catch (e) {
                    this.logger.error(e);
                }
            });
        }
    }

Let's decompose the steps to realize this example. First, we extend the ``init()`` method adding event listeners
on the socket using the ``on(msg, callback)`` function of the socket.io client. We then call the class method that
allows us to modify the state of the test variable (``this.updateTestVar(...)``). Finally, we return the resulting
value to the client via ``emit(msg, data)`` with the resulting value.


Error and Rights Management
~~~~~~~~~~~~~~~~~~~~~~~~~~~~
When interacting with the database the key challenge is error handling, marshalling (i.e. the translation of the DB
data representation into a suitable format for the frontend) and rights management.
For now, we assume that we want to call an already defined database a model ``Test`` specified in
``backend/db/models/test.js`` and integrate this call into the above example.
Let's also assume that only administrators are allowed to change this value.

.. note::

    Please refer to the guide on how to extend the database and add interface methods in :doc:`./database`.


.. code-block:: javascript

    /**
     * HEADER BOILERPLATE...
     */
    module.exports = class TestSocket extends Socket {
        /* ... */

        // method for updating the variable
        async updateTestVar(newVal){
            // use base class method to check for admin rights
            if (this.isAdmin()) {
                try {
                    const result = await this.models["test"].updateById("x", {val: newVal});
                    this.socket.emit("testResult", {success: true, val: result});
                } catch (e) {
                    this.socket.emit("testResult", {success: false, message: "Failed to update test!"});
                    this.logger.error("DB error while updating test" + JSON.stringify(e));
                }
            } else {
                // respond with a negative message
                this.socket.emit("testResult", {success: false, message: "User rights and argument mismatch"});
            }
        }

        init() {
            /* ... */

            // listen to testIncrement
            this.socket.on("testIncrement", async (data) => {
                try {
                    await this.updateTestVar(this.testVar + data.inc);
                } catch (e) {
                    this.logger.error(e);
                }
            });

            // listen to testReset
            this.socket.on("testReset", async () => {
                try {
                    await this.updateTestVar(0);
                } catch (e) {
                    this.logger.error(e);
                }
            }
        }
    }

Let's decompose the example again! We first update the ``updateTestVar`` to use the ``dbUpdateTest`` function interfacing
the database. Before making the actual call to the database, we check whether the user is an admin through the base
class ``isAdmin()`` method accessing the backend user information associated with the current connection. Because the
database query might fail, we add a try-catch-block around it. In case of an error at any stage, we send a negative
testResult back to the client.

.. note::

    It is crucial that you do full error handling on the socket level, i.e. at some point all exceptions should have been
    caught by a catch block. Otherwise, the webserver can crash due to minor errors during database interaction.


Broadcasting Responses
~~~~~~~~~~~~~~~~~~~~~~
To realize collaboration features, it might be desirable to join clients into rooms and multicast messages to these groups.
In exceptional cases, even a broadcast might make sense. You should use these two options `very` sparingly, because they
imply a lot of network traffic.

To join a client to a socketio room, you can simply use the ``join(name)`` function on the socket object:

.. code-block:: javascript

    this.socket.join("roomName");


To multicast a message to a room, you need to access the io object of the base class.

.. code-block:: javascript

    this.io.to("roomName").emit("msg", data);

Testing
~~~~~~~

Please think about how to test your socket. In general, you should test the functionality in isolation.
We refer to the section on :doc:`./testing` for more information on how to test your code.

Socket Communication Schema
---------------------------

In order to streamline socket communication, especially when interacting with the database, CARE defines a standardized way to register and handle socket events using the ``createSocket`` method provided by backend/webserver/Socket.js. 
This schema helps to ensure consistent error handling, optional transaction safety, and frontend compatibility.

createSocket: How it works
~~~~~~~~~~~~~~~~~~~~~~~~~~

The ``createSocket`` method allows you to define a socket event with built-in support for:

- Error handling
- Optional transaction wrapping
- Automatic frontend success/failure callbacks
- Clean backend-to-frontend event emission after database changes

.. code-block:: javascript

    createSocket(eventName, func, options = {}, transaction = false)

**Arguments:**
    - ``eventName``: Name of the socket event to register
    - ``func``: Async function handling the request, with parameters ``(data, options)``
    - ``options``: Object passed through the socket pipeline (e.g., for DB access)
    - ``transaction``: If ``true``, wraps execution in a Sequelize DB transaction

See a full example of the usage of createSocket in :ref:`document-create-example`.

Transaction Usage
~~~~~~~~~~~~~~~~~

If your socket operation modifies data, set ``transaction = true``. This will:
    - Open a Sequelize transaction
    - Pass it to your function via ``options.transaction``
    - Automatically commit/rollback
    - Allow you to define `afterCommit()` behavior

.. code-block:: javascript

    this.createSocket("studySaveAsTemplate", this.saveStudyAsTemplate, {}, true);

    async saveStudyAsTemplate(data, options) {
        const study = await this.models["study"].getById(data.id);

        if (this.checkUserAccess(study.userId)) {
            const template = await this.models["study"].add({
                ...study,
                id: undefined,
                hash: undefined,
                template: true,
            }, {transaction: options.transaction});

            options.transaction.afterCommit(() => {
                this.emit("studyRefresh", template);
            });

            return template;
        } else {
            throw new Error("No permission to save study as template");
        }
    }

See a further example of the transaction usage in :ref:`document-create-example`.

.. note::

    For a detailed explanation of how to notify the frontend after a transaction, including automatic tracking and manual `afterCommit` hooks, see :ref:`tracking-db-changes`.

Try-Catch Behavior
~~~~~~~~~~~~~~~~~~

Using ``createSocket`` wraps your function call in an automatic ``try-catch`` block. If an error is thrown:
    - The transaction is rolled back (if enabled)
    - A callback with ``success: false`` and the error message is sent to the frontend

No need to write:

.. code-block:: javascript

    try {
        ...
    } catch (e) {
        ...
    }

Just throw an error inside your function:

.. code-block:: javascript

    if (!this.checkUserAccess(...)) {
        throw new Error("Access denied");
    }

Frontend Error Display
~~~~~~~~~~~~~~~~~~~~~~

Every socket event should handle both success and failure responses in the callback. CARE’s frontend uses a centralized event bus (`this.eventBus`) to manage UI interactions like toast notifications.

.. code-block:: javascript

    this.$socket.emit("studySaveAsTemplate", {id: 1}, (result) => {
        if (!result.success) {
            this.eventBus.emit("toast", {
                title: "Template Save Failed",
                message: result.message,
                variant: "danger",
            });
        } else {
            this.eventBus.emit("toast", {
                title: "Success",
                message: "Study saved as template",
                variant: "success",
            });
        }
    });

See a further example of the usage of this.eventBus.emit in :ref:`document-create-example`.

Transaction Failure Handling
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

If an error is thrown inside a socket using ``transaction = true``, the transaction will be **automatically rolled back**.

.. note::

    You do **not** need to call ``rollback()`` manually when using ``createSocket``.

.. _tracking-db-changes:

Tracking DB Changes (afterCommit)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

In some cases, you may need to manually notify the frontend after a successful transaction. This is necessary **only when automatic tracking via `autoTable` does not apply** — for example, when:

- Writing files to disk
- Returning plain objects or custom responses
- Using models that do not have `autoTable = true`

In these cases, you can register a manual `afterCommit` hook on the transaction object:

.. code-block:: javascript

    const doc = await this.models["document"].add({
        name: data.name,
        type: data.type,
        userId: this.userId
    }, {transaction: options.transaction});

    fs.writeFileSync(target, data.file);

    options.transaction.afterCommit(() => {
        this.emit("documentRefresh", doc);
    });

This ensures that your emit to the frontend occurs **only after** the transaction and any side-effects (like file operations) have completed successfully.

Docstring Standards
~~~~~~~~~~~~~~~~~~~

Each socket handler function should be documented using JSDoc-style comments. The docstring must include:

- A short summary of what the function does
- A full list of ``data`` sub-parameters, including type and purpose
- Description of ``options`` if used
- The return type and structure

**Example:**

.. code-block:: javascript

    /**
     * Create a new document for the user
     * @param {object} data
     * @param {number} data.type - The document type (1 = PDF, 2 = HTML)
     * @param {string} data.name - The name of the document
     * @param {object} options - Internal options (contains DB transaction if used)
     * @returns {Promise<object>} The created document object
     */

.. _document-create-example:

Example Lifecycle
~~~~~~~~~~~~~~~~~

Here is a full example showing how the backend and frontend work together when using ``createSocket`` for creating a new document.

**Frontend: emit event and handle result with a toast**

.. code-block:: javascript

    this.$socket.emit("documentCreate", {
      type: 1,
      name: this.name,
    }, (res) => {
      if (res.success) {
        this.$refs.createModal.close();
        this.eventBus.emit("toast", {
          message: "Document successfully created!",
          title: "Success",
          variant: "success",
        });
      } else {
        this.$refs.createModal.waiting = false;
        this.eventBus.emit("toast", {
          message: res.message,
          title: "Error",
          variant: "danger",
        });
      }
    });

**Backend: register the socket**

.. code-block:: javascript

    this.createSocket("documentCreate", this.createDocument, {}, true);

**Backend: handler function implementation**

.. code-block:: javascript

    /**
     * Create document (HTML)
     * @param data {type: number, name: string}
     * @param options
     * @returns {Promise<object>}
     */
    async createDocument(data, options) {
        const doc = await this.models["document"].add({
            name: data.name,
            type: data.type,
            userId: this.userId
        }, {transaction: options.transaction});

        options.transaction.afterCommit(() => {
            this.emit("documentRefresh", doc);
        });

        return doc;
    }

**What happens internally:**

1. `createSocket` listens for `"documentCreate"` on the socket
2. When the event is triggered from the frontend:

   - The handler `createDocument` runs
   - A Sequelize transaction is opened and passed as `options.transaction`
3. If the function completes without error:

   - The transaction is committed
   - The `afterCommit` hook emits `"documentRefresh"` with the new document
   - The frontend receives `{ success: true, data: doc }`
   - A success toast is displayed
4. If an error is thrown:

   - The transaction is rolled back
   - The frontend receives `{ success: false, message }`
   - An error toast is displayed
