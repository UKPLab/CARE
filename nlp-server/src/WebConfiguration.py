import os

import redis

_singleton = None
DEFAULT = {
    "log": True,
    "debug": True,

    "secret_key": "DEBUGGING-SECRET-KEY",
    "session_backend": "redis://redis:6379",
    "result_backend": "redis://redis:6379",
    "broker": "amqp://guest:guest@rabbitmq:5672",
    "resources_dir": "/upload",

    "app": {
        "host": "0.0.0.0",
        "port": "6000",
    },

    "grobid": {
        "grobid_server": "grobid",
        "grobid_port": "8070",
        "batch_size": 1000,
        "coordinates": ["persName", "figure", "ref", "biblStruct", "formula", "s" ],
        "sleep_time": 5,
        "timeout": 60
    },
}


def instance(**kwargs):
    global _singleton

    if _singleton is None:
        _singleton = WebConfiguration(**kwargs)
    else:
        _singleton.update(**kwargs)

    return _singleton


class WebConfiguration:
    def __init__(self, **kwargs):
        self.conf = DEFAULT.copy()

        self.flask = None
        self.session = None
        self.celery = None
        self.socketio = None
        self.app = None

        self.update(**kwargs)

    def update(self, secret_key: str = None,
                     session_backend: str = None,
                     result_backend: str = None,
                     broker: str = None,
                     resources_dir: str = None,
                     app: dict = None,
                     grobid: dict = None,
                     debug: bool = None,
                     log: bool = None):
        # update config
        if secret_key is not None:
            self.conf["secret_key"] = secret_key
        if session_backend is not None:
            self.conf["session_backend"] = session_backend
        if result_backend is not None:
            self.conf["result_backend"] = result_backend
        if broker is not None:
            self.conf["broker"] = broker
        if app is not None:
            self.conf["app"] = app
        if debug is not None:
            self.conf["debug"] = debug
        if log is not None:
            self.conf["log"] = log
        if grobid is not None:
            self.conf["grobid"] = grobid
        if resources_dir is not None:
            self.conf["resources_dir"] = resources_dir

        # init default values based on the provided information
        self.setup()

    def setup(self):
        self.flask = {
            "SECRET_KEY": self.conf["secret_key"],
            "CELERY_RESULT_BACKEND": self.conf["result_backend"],
            "CELERY_BROKER_URL": self.conf["broker"],
            "UPLOAD_FOLDER": os.path.abspath(self.conf["resources_dir"]),
            "CELERY_RESULT_SERIALIZER": 'pickle',
            "CELERY_TASK_SERIALIZER":'pickle',
            "CELERY_ACCEPT_CONTENT": ['pickle']
        }

        self.session = {
            "SESSION_TYPE": "redis",
            "SESSION_PERMANENT": False,
            "SESSION_USE_SIGNER": True,
            "SESSION_REDIS": redis.from_url(self.conf["session_backend"])
        }

        self.socketio = {
            "cors_allowed_origins": '*',
            "message_queue": self.conf["broker"],
            "logger": self.conf["log"],
            "engineio_logger": self.conf["log"]
        }

        self.celery = {
            "backend": self.conf["result_backend"],
            "broker": self.conf["broker"]
        }

        self.app = {
            "debug": self.conf["debug"]
        }
        self.app.update(self.conf["app"])

        self.grobid = self.conf["grobid"]