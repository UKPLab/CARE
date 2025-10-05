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

.. seealso::
   For the generic create/update entry point used by the frontend, see
   :ref:`AppDataUpdate Socket <appdataupdate-socket>`.

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
Let's assume we want to extend a socket ``TestSocket`` defined in ``./backend/webserver/sockets/test.js``. Generally,
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
``./backend/db/models/test.js`` and integrate this call into the above example.
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

In order to streamline socket communication, especially when interacting with the database, CARE defines a standardized way to register and handle socket events using the ``createSocket`` method provided by ``./backend/webserver/Socket.js``. 
This schema helps to ensure consistent error handling, optional transaction safety, and frontend compatibility.

.. _createSocket:

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
    - ``options``: Object passed through the socket pipeline; can contain any contextual data (e.g., transaction info, user session, metadata)
    - ``transaction``: If ``true``, wraps execution in a Sequelize DB transaction

.. warning::

   If your handler function performs **any database write operations** (e.g., `create`, `update`), you **must** set ``transaction = true`` and use the provided transaction object inside the function. Failing to do so can result in inconsistent or partial data states.

.. note::

   The ``createSocket`` function should always be called within the ``init()`` method of socket classes located in ``./backend/webserver/sockets/*``.  
   The handler function passed to it should be a **method of the class itself**, not an inline function or a function defined inside ``init()``.  

See a full example of the usage of createSocket in :ref:`document-create-example`.

.. seealso::
   How DB writes propagate to the UI (transactions, commit broadcasts, Vuex refresh):
   :doc:`Data Transfer <data_transfer>` — especially :ref:`Data Flow <data-flow>`.

.. _socket-db-transaction:

Transaction Usage
~~~~~~~~~~~~~~~~~

If your socket operation modifies data, set ``transaction = true``. This will:
    - Open a Sequelize transaction
    - Pass it to your function via ``options.transaction``
    - Automatically commit/rollback
    - Allow you to define `afterCommit()` behavior

.. code-block:: javascript

    init() {
        this.createSocket("studySaveAsTemplate", this.saveStudyAsTemplate, {}, true);
        }

.. code-block:: javascript

    /**
    * Save the current study as a template (creates a new study with template: true).
    * 
    * @param {object} data - The input data from the socket call.
    * @param {number} data.id - ID of the study to duplicate as a template.
    * @param {object} options - Context passed through the socket pipeline. 
    * @returns {Promise<object>} The newly created template study.
    */
    async saveStudyAsTemplate(data, options) {
        const study = await this.models["study"].getById(data.id);

        if (this.checkUserAccess(study.userId)) {
            const template = await this.models["study"].add({
                ...study,
                id: undefined,
                hash: undefined,
                template: true,
            }, {transaction: options.transaction});

            // Code executed after transaction commit success (code only, without further DB changes!)
            options.transaction.afterCommit(() => {
                this.emit("studyRefresh", template);
            });

            return template; // The value sent back to the frontend via the socket callback
        } else {
            throw new Error("No permission to save study as template");
        }
    }

.. note::

   - Socket handler functions should always include clear JSDoc-style docstrings describing the expected data parameters, transaction context, and return type.  
     For full documentation standards, refer to: :doc:`../basics/conventions`.

   - For a detailed explanation of how to notify the frontend after a transaction, including automatic tracking (via ``autoTable``) and manual ``afterCommit`` hooks, see: :ref:`tracking-db-changes`.


See a further example of the transaction usage in :ref:`document-create-example`.

**Transaction Failure Handling**

If an error is thrown inside a socket using ``transaction = true``, the transaction will be **automatically rolled back**.

.. warning::

    Do **not** call ``transaction.commit()`` or ``transaction.rollback()`` manually when using ``createSocket``.  
    These are handled automatically, and calling them yourself can lead to runtime errors — they can only be called **once** per transaction.

Try-Catch Behavior
~~~~~~~~~~~~~~~~~~

Using ``createSocket`` wraps your function call in an automatic ``try-catch`` block. If an error is thrown:
    - The transaction is rolled back (if enabled)
    - A callback with ``success: false`` and the error message is sent to the frontend

See the section above on :ref:`createSocket: How it works` for more details.

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

Socket Callback Responses
~~~~~~~~~~~~~~~~~~~~~~~~~

When a socket event completes, a callback function on the frontend receives a standardized response object:

.. code-block:: javascript

    {
        success: true,        // true if the backend handler completed without errors
        data: {...},          // the return value from the backend function (if successful)
        message: "..."        // an optional error message if an error was thrown
    }

This structure is automatically handled by ``createSocket``:

- If the backend handler throws an error, ``success`` is set to ``false`` and ``message`` contains the error.
- If the function returns a value, it is included as ``data`` and ``success`` is set to ``true``.

The following example uses CARE’s global toast system to display success or failure. For full documentation on toast messages, see :doc:`../frontend/toasts`.

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

.. _tracking-db-changes:

Tracking DB Changes (afterCommit)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

In most cases, when using models with ``autoTable = true``, CARE will **automatically track database changes**  
and push updates directly to the frontend. This includes creation, updates, and deletions — no need to manually emit a ``...Refresh`` event.

However, in **special cases** where ``autoTable`` is not used or doesn't apply, you may need to manually notify the frontend after a successful transaction. Examples include:

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

.. warning::

    In normal use cases (e.g., with ``autoTable = true``), **you do not need to use `afterCommit()` or manually emit refresh events**.  
    CARE tracks database changes automatically and handles frontend updates for you.

.. seealso::
   When using ``autoTable`` models, commit-time change tracking and ``<table>Refresh`` emits are automatic.
   Details in :ref:`Store Updates & <table>Refresh> Events <table-refresh-events>`.

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
        title: "Success",
        message: res.data, // This will be: "Document successfully created"
        variant: "success",
        });
      } else {
        this.$refs.createModal.waiting = false;
        this.eventBus.emit("toast", {
        title: "Error",
        message: res.message, // This will be: "Missing required fields: name and type"
        variant: "danger",
        });
      }
    });

**Backend: register the socket**

.. code-block:: javascript

    init() {
        this.createSocket("documentCreate", this.createDocument, {}, true);
        }

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
            // Backend log entry instead of manual frontend emit; frontend is auto-updated via autoTable
            this.logger.info(`Document created (id: ${doc.id}) by user ${this.userId}`);
        });

        return "Document successfully created";
    }

**What happens internally:**

1. `createSocket` listens for `"documentCreate"` on the socket

2. When the event is triggered from the frontend:

   - The handler ``createDocument`` runs
   - A Sequelize transaction is opened and passed as ``options.transaction``

3. If the function completes without error:

   - The transaction is committed
   - The `afterCommit` hook logs a backend info message (no manual frontend emit is needed; updates are handled automatically via `autoTable`)
   - The frontend receives ``{ success: true, data: "Document successfully created" }``
   - A success toast is displayed using that message

4. If an error is thrown:

   - The transaction is rolled back
   - The frontend receives ``{ success: false, message: "..." }`` with the error message
   - An error toast is displayed using that message

Socket functions
-------------------------

Annotation Socket Functions (`annotation.js`)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
.. js:autoclass:: AnnotationSocket
   :members:

App Socket Functions (`app.js`)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
.. js:autoclass:: AppSocket
   :members:

Assignment Socket Functions (`assignment.js`)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
.. js:autoclass:: AssignmentSocket
   :members:

Collab Socket Functions (`collab.js`)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
.. js:autoclass:: CollabSocket
   :members:

Comment Socket Functions (`comment.js`)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
.. js:autoclass:: CommentSocket
   :members:

Document Socket Functions (`document.js`)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
.. js:autoclass:: DocumentSocket
   :members:

Logger Socket Functions (`log.js`)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
.. js:autoclass:: LoggerSocket
   :members:

Service Socket Functions (`service.js`)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
.. js:autoclass:: ServiceSocket
   :members:

Setting Socket Functions (`setting.js`)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
.. js:autoclass:: SettingSocket
   :members:

Statistic Socket Functions (`statistic.js`)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
.. js:autoclass:: StatisticSocket
   :members:

Study Session Socket Functions (`study_session.js`)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
.. js:autoclass:: StudySessionSocket
   :members:

Study Socket Functions (`study.js`)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
.. js:autoclass:: StudySocket
   :members:

User Socket Functions (`user.js`)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
.. js:autoclass:: UserSocket
   :members: