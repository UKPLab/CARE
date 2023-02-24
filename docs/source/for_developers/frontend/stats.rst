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

    this.$socket.emit("stats", {
      action: "<action type>",
      data: {}                      //add any data information into the object
    })

Each logged user interaction is assigned a timestamp (according to the time of storing in the backend) and the user id allowing to
generate trace data from all logged interactions.

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

.. code-block:: vue-js

    <template>
     <button id="specialButton" @click="log">Hello!</button>
    </template>
    <script>
    //... BOILERPLATE
    methods: {
        //... other methods
        log(){
            this.$socket.emit("stats", {
              action: "specialButtonClick",
              data: {id: Math.random()}
            })
        }
    }
    </script>