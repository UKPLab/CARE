User Statistics
===============

If users agree to the collection of their behavior traces during registration, the CARE frontend collects and stores
the user face interaction traces in the database. This data can be used to analyze the importance of different features,
compare different implementations and simply generate statistics on users.

If you add new features or components, it makes sense to extend the user statistics logging. Below we outline the stats
logging interface and how to log new interactions.

User Statistics Logging
------------------------

To log statistics you need to provide an action type (i.e. the type of interaction you are logging) and an arbitrary
data object that specifies the parameters of the interaction (e.g. the page number that is moved into the viewport).
Send these information over the websocket on the ``stats`` message type, to log them in the database.

.. code-block:: javascript

    if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "<action type>",
          data: {}                      //add any data information into the object
        })
    }

Each logged user interaction is assigned a timestamp (according to the time of storing in the backend) and the user id allowing to
generate trace data from all logged interactions.

.. note::

    Statistics are only logged if the user has agreed to the data collection during registration!
    If the user has not agreed, we do not log any statistics. This is ensured by the backend!
    Admins can configure consent defaults in :doc:`../examples/settings`.
    But we also want to reduce the network traffic and the load on the backend, so make sure you check the `acceptStats` flag!

You can inject the `acceptStats` variable into any component by using:

.. code-block:: javascript

    inject: {
        acceptStats: {
            default: () => false
        }
    }


Logging a New Interaction
--------------------------
Let's assume we want to log a new interaction ``specialButtonClick`` upon click on a button. Please always use
camelcasing for the action types and make them uniquely identifiable for a specific component in the frontend. This
helps to keep track of the different interaction types and process them in the database.

.. note::

    While more fine-grained behavior logging implies more information, be aware that each logged interaction causes
    network traffic and requires database storage. Please have this in mind and check if you want to track very
    frequent interactions (e.g. mouse movements) or when you log large accompanying statistics data (e.g. whole
    paragraph texts).

To log the button click, we can simply execute the statistics logging snippet defined above on click of the button.
Likewise, you can listen to component events (using a ``watch``) or child component messages (using ``@`` on child
messages).

For our simple example, the code would look like this:

.. code-block:: html

    <template>
     <button id="specialButton" @click="log">Hello!</button>
    </template>

.. code-block:: javascript

    methods: {
        log(){
            if (this.acceptStats) {
                this.$socket.emit("stats", {
                  action: "specialButtonClick",
                  data: {id: Math.random()}
                })
            }
        }
    }

Advanced Logging Class
------------------------
The ``BehaviorLogger`` class is a dedicated logging class that unifies several high-level logging functions in one file.
It is designed to serve as a centralized baseclass for the existing logging functionalities, minimizing the effort of
adding new logging functionalities and to keep the logging logic in one place, without cluttering the project's
components.

The class is implemented in the file frontend/src/assets/behaviorLogger.js.

Currently, the class logs the following interactions:

- Device & Browser Information
- Route Changes
- Tab visibility changes
- Mouse move events
- Click events
- Specific key down events (currently only cmd/ctrl + f to detect search start)
- Window focus events (currently only used to detect search end)

Extending the Logging Class
^^^^^^^^^^^^^^^^^^^^^^^^^^^^

To log a new interaction, you can extend an existing logging function or create a new one. For example, we could extend
the key down logging function to log a new interaction when the user presses a specific key or key combination:

.. code-block:: javascript

        handleKeyDown(event) {
            // Previous code ...
            if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
                // Search started
                this.startSearch();
            }
            // New code ...
            if (event.key === 's') {
                this.handleNewInteraction();
            }
        }

The ``handleNewInteraction`` function would then dictate the logic on how to interpret the event and send the log to
the statistics table.

.. code-block:: javascript

        handleNewInteraction() {
            this.socket.emit("stats", {
              action: "newInteraction",
              data: {id: Math.random()}
            })
        }

.. important::
    When extending the BehaviorLogger class, make sure to follow these general guidelines:

    1. Bind new logging functions in the constructor to maintain the correct context.
    2. Add new event listeners to both ``init()`` and ``destroy()`` methods.
    3. Use the existing WebSocket connection (``this.socket.emit``) to send data to the backend.
    4. Consider performance optimizations (like debouncing) for frequent events.

Usage in CARE
^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The ``BehaviorLogger`` class is instantiated in the main App component (`App.vue`).
It is initialized after the application settings are loaded, as it requires access to certain configuration values
(like the mouse debounce time).

This initialization ensures that user behavior logging begins as soon as the application is ready,
providing comprehensive tracking of user interactions from the start of the user session.