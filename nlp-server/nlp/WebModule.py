import abc
from flask_socketio import SocketIO


class WebModule(abc.ABC):
    def __init__(self, server, socketio: SocketIO):
        self.socketio = socketio
        self.server = server

        self.on_setup()

    @abc.abstractmethod
    def on_setup(self):
        """
        Init WebSocket Subscriber
        """
        pass

    @abc.abstractmethod
    def on_reset(self):
        """
        Which data send to Websocket for complete status update
        """
        pass

    @abc.abstractmethod
    def name(self):
        return ""

