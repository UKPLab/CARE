from typing import Type

#from WebModule import WebModule
from flask_socketio import SocketIO


def make_socketio(app):
    print("making socketio")

    BROKER_URL = "CELERY_BROKER_URL"
    if BROKER_URL in app.config:
        socketio = SocketIO(app,
                            message_queue=app.config[BROKER_URL],
                            cors_allowed_origins='*',
                            #async_mode='eventlet',
                            logger=True,
                            engineio_logger=True)
    else:
        socketio = SocketIO(app,
                            cors_allowed_origins='*',
                            async_mode='threading',
                            logger=True,
                            engineio_logger=True)

    return socketio


class WebServer:
    def __init__(self, flask, celery, config):
        self.config = config
        self.modules = {}

        self.socketio = None
        self.app = flask
        self.celery = celery

        self.is_connected = False
        self.status_thread = None

        self.setup()

    def init_modules(self, module):#: Type[WebModule]):
        self.modules[module.name] = module(server=self, socketio=self.socketio)

    def reset_modules(self):
        for module in self.modules:
            self.modules[module].on_reset()

    def setup(self):
        # socketio
        self.socketio = make_socketio(self.app)

        print("Setting up socketio listeners")

        #TODO self.init_modules(...)

        # base listeners
        def connect(data=None):
            print("Client connected...!")
            self.is_connected = True
            self.reset_modules()

        def disconnect():
            print("Client disconnected...!")
            self.is_connected = False

        def test(data):
            print("Client messaged...!")
            self.test += data
            print("input", self.test)

        self.socketio.on('connect', connect)
        self.socketio.on('disconnect', disconnect)
        self.socketio.on('message', test) #TODO remove

    def start(self):
        print("runnin socketio server")
        self.socketio.run(self.app,
                          host="0.0.0.0",
                          debug=True,
                          port=6000)


if __name__ == "__main__":
    print("nothing")
    #ws = WebServer(app, celery, None)
    #ws.start()