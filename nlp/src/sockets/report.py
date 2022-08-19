from . import SocketRoute
from flask_socketio import emit

from flask import session

from celery_app import generate_report
from celery.result import AsyncResult


class ReportRoute(SocketRoute):
    def __init__(self, path, socketio, celery):
        super().__init__(path, socketio, celery)

    def _init(self):
        self.socketio.on_event(f"{self.path}/req", self.gen_report())

    def gen_report(self):
        def handler(data):
            sid = session["sid"]
            print("Generating report.....")
            generate_report.delay(data, sid, f"{self.path}/res")

        return handler