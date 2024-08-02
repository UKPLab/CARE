RPC Calls (last updated: 02.08.2024 with commit 0a57603456ad0297f5e7be716860a384e86cfe37 on branch feat-270-rpc)
=========

Goals
-----
- Execute resource-intensive/different language code in a separate process (RPC).
- External code should reside in Docker. All RPC Docker containers should be started with the rest of CARE.
- Establish a standardized interface and protocol for RPCs to allow seamless switching and addition of new RPCs regardless of functionality and underlying platforms.

All relevant files are located in the ``backend/webserver`` folder.

RPC Services Components
-----------------------

``backend/webserver/RPC.js``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~
- Provides logging and information for:
  - Initializing RPC
  - Closing RPC
  - Calling data
  - Getting online status of RPC (false: offline, true: online)

``backend/webserver/Server.js``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
- Adds RPCs and initializes them from the ``./rpcs`` path.

Adding a New RPC Call - Follow the test example
-----------------------------------------------
1. **Create a Docker Container**:
   - Copy the entire ``utils/rpcs/test`` folder to ``utils/rpcs/<your-testname>``.
   - Adjust the new folder to include: ``Dockerfile``, ``requirements.txt`` (ensure the latest versions of packages), ``main.py``.

2. **Update ``docker-compose.yml``**:
   - Add your test and change the corresponding variables.

.. code-block:: yaml

    rpc_test:
      build:
        context: ./utils/rpcs/test
        dockerfile: Dockerfile
      command: python3 main.py
      restart: unless-stopped

3. **Build Docker Container**:
   - Run the command: ``docker compose -f docker-compose.yml build <your-testname>``.

4. **Update RPCs in Backend**:
   - In the ``backend/webserver/rpcs`` folder, copy ``test.js`` to ``<your-testname>.js`` and adjust the content.

Refer to the `test.js` file for detailed implementation.

5. **Update Environment Variables**:
   - Add your test similarly to ``rpc_test`` in the ``.env`` file. See more information in Environment Configuration.

6. **Update ``docker-dev.yml``**:
   - Add test ports for your test similarly to ``rpc_test``.

.. code-block:: yaml

    rpc_test:
      ports:
        - ${RPC_TEST_PORT}:8080

7. **Run Docker Container**:
   - Execute the command: ``docker compose -f docker-compose.yml run <your-testname>``.

8. **Call RPC in Socket**:
   - Use ``this.server.rpcs['<your-testname>'].call(Dataobject)`` to call the RPC.

Refer to the respective code files for detailed implementation.

Environment Configuration
-------------------------
Add your new entries to the respective environment files:

**.env**
.. code-block:: bash

    # RPCs
    RPC_TEST_HOST=127.0.0.1
    RPC_TEST_PORT=3010

