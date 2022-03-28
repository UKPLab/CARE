from flask_socketio import Namespace, emit
from flask import session


class TestNamespace(Namespace):
    def __init__(self, namespace):
        super().__init__(namespace)

        self.state = 0

    def on_connect(self):
        pass

    def on_disconnect(self):
        pass

    def on_my_event(self, data):
        self.state += 1
        if "h" not in session:
            session["h"] = ""
        session["h"] += "x"

        emit('my_response', str(data) + str(self.state) + str(session["h"]))


class Manager():
    def __init__(self):
        self.state = 0

    def update(self):
        self.state += 1

    def get_state(self):
        return self.state