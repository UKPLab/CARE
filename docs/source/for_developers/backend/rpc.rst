RPC Service
===========

Remote Procedure Call services (RPCs) are used to execute resource-intensive or different language code in a separate process.
This is done to prevent the main server (node.js backend) from being blocked by the execution of such code.
Therefore we introduce a standardized interface and protocol for RPCs to allow seamless switching and addition of new RPCs regardless of functionality and underlying platforms.
Communication between the main server and the RPCs is done via a websocket connection, to ensure persistent communication and low latency.
The external code is executed in a Docker container, and usually started with the rest of CARE.

Implementing a new RPC service
------------------------------

To implement a new RPC service, you can orient yourself on the existing test RPC service example.
Here you can find a simple python script that provides a scalable `python-socketio <https://python-socketio.readthedocs.io/en/latest/server.html>`_ server implementation for answering RPC calls.

The example consists of the following components:

Docker Container
~~~~~~~~~~~~~~~~

The Docker container is responsible for executing the external code.

.. code-block:: bash

    utils/rpcs/test/
    ├── Dockerfile
    ├── main.py
    └── requirements.txt

The ``Dockerfile`` is used to build the Docker container and install the necessary packages.
The ``requirements.txt`` file contains the necessary packages that are installed in the Docker container.
The ``main.py`` file contains the websocket interface and the code that is executed when the RPC is called.

For a new RPC service, you can copy the ``utils/rpcs/test/`` folder and adjust the files to your needs.
If you want to extend the RPC service with more complex features, you can just add a `listening socket <https://python-socketio.readthedocs.io/en/latest/server.html#listening-to-events>`_ to the ``main.py`` file.

.. code-block:: python

    @sio.on("my custom event")
    def event(sid, data):
        logger.info(f"Received call: {data} from {sid}")
        # Do something with the data
        return <response>

.. warning::
    To be able to use the RPC service, the Docker container must be started with the rest of CARE.
    Therefore, you have to add the Docker container to the ``docker-compose.yml`` and ``docker-dev.yml`` file in the root folder.
    See `rpc_test` as an example or read the `Environment`_ section.

.. tip::
    To build the Docker container, you can use the ``docker compose -f docker-compose.yml build <rpc_service_name>`` command.
    To run the Docker container, you can use the ``docker compose -f docker-compose.yml run <rpc_service_name>`` command.

Backend Service
~~~~~~~~~~~~~~~

The backend service is responsible for managing the RPC services and executing the RPC calls.
All RPC services need to be added to the ``backend/webserver/rpcs/`` folder. The Example RPC service file is called ``test.js``.
It holds a class that is extended from the ``RPC`` class and implements additional methods, but at least the connection url with the environment variables (see `Environment`_ section).

.. note::
    The class name of your RPC service will be the name for calling your RPC service in the backend later.

The ``RPC`` class usually handles all the communication with the RPC service and provides a standard method to call the RPC service.
Please look at the ``backend/webserver/RPC.js`` file for a detailed implementation. To provide extended functionality, you can just add more methods to the RPC service class.

.. code-block:: javascript

    const RPC = require("../RPC.js");

    module.exports = class RPC<rpc_service_name> extends RPC {
        constructor(server) {
            const url = "ws://" + process.env.RPC_<rpc_service_name>_HOST + ":" + process.env.RPC_<rpc_service_name>_PORT;
            super(server, url);
        }

        /**
        * Simplest method to call your RPC service function and return a promise with the response
        * @param {Object} data - The data that is sent to the RPC service
        * @returns {Promise} - The response from the RPC service
        */
        async <rpc_service_function_name>(data) {
            try {
                return this.emit("<rpc_service_function_event_in_docker>", data);
            } catch (err) {
                throw err
            }
        }
    }


Environment
~~~~~~~~~~~

The environment variables are used to configure the RPC service.
With the environment variables, we make sure that the RPC service could run easily on different machines without changing the code.
Therefore, you have to add the environment variables to all ``*.env`` files in the root folder.

**.env**
.. code-block:: bash

    # RPCs
    RPC_TEST_HOST=127.0.0.1
    RPC_TEST_PORT=3010

.. note::
    The ``.env`` file is used for development, so the IP address is set to localhost and ``docker-dev.yaml`` publishes the ports to the host machine.
    The ``*.env`` files are used to build the fully docker environment, so the IP address is set to the docker network (i.e. the name of the machine defined in the ``docker-compose.yml`` file).

Furthermore, we want to make sure that the RPC service is started with the CARE environment.
Here we need to add the environment variables to the ``docker-compose.yml`` and ``docker-dev.yml`` file in the root folder.

**docker-compose.yml**
.. code-block:: yaml

    rpc_test:
      build:
        context: ./utils/rpcs/test
        dockerfile: Dockerfile
      command: command: gunicorn --workers 1 --threads 100 --bind 0.0.0.0:8080 'main:create_app()'
      restart: unless-stopped

**docker-dev.yml**
.. code-block:: yaml

    rpc_test:
      ports:
        - ${RPC_TEST_PORT}:8080

Lastly, we need to adapt the ``Makefile`` to build the Docker container.
By adding the docker machine name to the ``make docker`` command,
the Docker container is built and started with the CARE environment.

How to call the RPC service
---------------------------

To call the RPC service, you have to use the RPC service class that you implemented in the backend.
The RPC service class provides a method to call the RPC service and return a promise with the response.
The RPC service class name is the identifier for the RPC service.

.. code-block:: javascript

    try {
        const response = await this.server.rpcs['<rpc_service_name>'].<rpc_service_function_name>(data);
        // Do something with the response
    } catch (err) {
        // Handle the error
    }

Unit Tests
----------

It is always a good idea to write unit tests during the implementation of a new RPC service.
The unit tests should cover the most important parts of the RPC service. The tests are located in the ``backend/tests/rpcs`` folder.
Each RPC service has its own test file, which is named after the RPC service class.
Here you can add simple tests to check if the RPC service is working as expected.

.. code-block:: javascript

    const Server = require("../../webserver/Server.js");

    describe('<RPC service name>', () => {

        /**
         * Test your RPC function
         */
        test('<your rpc function name>', async () => {
            let server = new Server();

            // wait until RPC service is connected
            await server.rpcs["<RPC service name>"].wait();

            // check status
            expect(await server.rpcs["<RPC service name>"].isOnline()).toEqual(true);

            // call rpc and check response
            const response = await server.rpcs["<RPC service name>"].<your rpc function name>(<test object>);
            expect(response).toEqual(<response object>)

        })

    })

Now you can run the unit tests with ``make test-rpc``.

.. warning::
    When running the unit tests locally, make sure your RPC service is running (e.g., ``make docker`` or ``docker compose -f docker-compose.yml -f docker-dev.yml down <rpc_service_docker_name>``).
