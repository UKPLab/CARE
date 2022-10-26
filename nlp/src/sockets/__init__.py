from abc import ABC, abstractmethod


class SocketRoute(ABC):
    def __init__(self, path, socketio, celery=None):
        self.path = path
        self.socketio = socketio
        self.celery = celery

        self._init()

    @abstractmethod
    def _init(self):
        pass