from . import SocketRoute
from flask_socketio import emit

from flask import session

from celery_app import simple_task
from celery.result import AsyncResult


class TestRoute(SocketRoute):
    def __init__(self, path, socketio):
        super().__init__(path, socketio)

    def _init(self):
        self.socketio.on_event(f"{self.path}/test_emit", self.test())
        self.socketio.on_event(f"{self.path}/simple_test", self.simple_test())
        self.socketio.on_event(f"{self.path}/init_bot_test", self.init_bot_test())

    def test(self):
        def handler(data):
            print("Received data")
            emit(f"{self.path}/test_res", "no data")

        return handler

    def simple_test(self):
        def handler(data):
            sid = session["sid"]
            task = simple_task.delay(input, sid)

            session["simple_test_task"] = task

        return handler

    def init_bot_test(self):
        def handler(data):
            emit("init_bot_res", "resulty mcresult face")

        return handler