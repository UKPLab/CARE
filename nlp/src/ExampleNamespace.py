""" ExampleNamespace -- Example for using socketio namespaces

Check this example namespace for socketio to define your own.
This adds ease of management and modularization to the code
for managing socketio.

Author: Nils Dycke (dycke@ukp...)
"""

from flask_socketio import Namespace, emit
from flask import session


class ExampleNamespace(Namespace):
    """
    This uses a flask_socketio provided feature to map all requests on a certain channel, i.e.
    that setup a connection at (host:port/channel) to make calls in this class. Specifically,
    you can define methods starting with "on_" as event listeners to messages under that name.

    To access state use the session object of flask. To respond use the emit function of
    socketio.

    Use this concept to modularize your code and manage the socketio events in a different
    place than adding them plainly in the app.py.
    """
    def __init__(self, namespace):
        super().__init__(namespace)

        self.state = 0

    def on_connect(self):
        """
        This method basically replaces socketio.on("connect") for this particular namespace.

        :return:
        """
        pass

    def on_disconnect(self):
        """
        This method basically replaces socketio.on("disconnect") for this particular namespace.

        :return:
        """
        pass

    def on_hello_world(self, data):
        """
        This method replaces socketio.on("hello_world") for this particular namespace.

        :param data:
        :return:
        """
        # updates the state -- that's not user specific and insecure with threading, but it's possible
        self.state += 1

        # access the session object of flask to use it for storing connection-specific information
        if "h" not in session:
            session["h"] = ""
        session["h"] += "x"

        # uses the flask_socketio emit method to send a response on "hello_response"
        emit('hello_response', str(data) + str(self.state) + str(session["h"]))