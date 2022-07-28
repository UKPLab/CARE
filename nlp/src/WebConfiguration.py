""" WebConfiguration -- Singleton for holding global configuration

This file defines the global configuration and makes it accessible as a
singleton variable. Any changes made to an instance of the configuration
are propagated to all other instances.

A default configuration is loaded, if not specified otherwise.

Author: Nils Dycke (dycke@ukp...)
"""

import redis
import os

# holds the configuration object
_singleton = None

# env variables
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST")
RABBITMQ_PORT = os.getenv("RABBITMQ_PORT")
REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_PORT = os.getenv("REDIS_PORT")
GROBID_HOST = os.getenv("GROBID_HOST")
GROBID_PORT = os.getenv("GROBID_PORT")
NLP_PORT = os.getenv("NLP_PORT")


# default config of all environmental parameters.
# the parameters in "app" are passed to the flask app specifically
# the parameters in "grobid" are passed to grobid specifically
DEFAULT = {
    "name": "peer_nlp",

    "log": True,
    "debug": False,

    "secret_key": "DEFAULT-SECRET-KEY",
    "session_backend": f"redis://{REDIS_HOST}:{REDIS_PORT}",
    "result_backend": f"redis://{REDIS_HOST}:{REDIS_PORT}",
    "broker": f"amqp://guest:guest@{RABBITMQ_HOST}:{RABBITMQ_PORT}",

    "app": {
        "host": "0.0.0.0",
        "port": NLP_PORT,
    },

    "grobid": {
        "grobid_server": GROBID_HOST,
        "grobid_port": GROBID_PORT,
        "batch_size": 1000,
        "coordinates": ["persName", "figure", "ref", "biblStruct", "formula", "s" ],
        "sleep_time": 5,
        "timeout": 60
    },
}

DEFAULT_DEV = {
    "name": "peer_nlp",

    "log": True,
    "debug": False,  # currently: discouraged; you need a proper debugger setup for that to work

    "secret_key": "DEBUGGING-SECRET-KEY",
    "session_backend": f"redis://{REDIS_HOST}:{REDIS_PORT}",
    "result_backend": f"redis://{REDIS_HOST}:{REDIS_PORT}",
    "broker": f"amqp://guest:guest@{RABBITMQ_HOST}:{RABBITMQ_PORT}",

    "app": {
        "host": "127.0.0.1",
        "port": NLP_PORT
    },

    "grobid": {
        "grobid_server": GROBID_HOST,
        "grobid_port": GROBID_PORT,
        "batch_size": 1000,
        "coordinates": ["persName", "figure", "ref", "biblStruct", "formula", "s"],
        "sleep_time": 5,
        "timeout": 60
    }
}


def instance(**kwargs):
    """
    Returns the global configuration; if not existent yet, a new one is created by the
    given paramters.

    :param kwargs: see WebConfiguration
    :return: the web configuration object in use
    """
    global _singleton

    if _singleton is None:
        _singleton = WebConfiguration(**kwargs)
    else:
        _singleton.update(**kwargs)

    return _singleton


class WebConfiguration:
    """
    Object for getting and updating the paramters for running the web server.

    If you need to add more components to this configuration, add an attribute
    to the class, add a parameter to the update function and update the
    conf attribute accordingly.
    """
    def __init__(self, **kwargs):
        if "dev" in kwargs:
            self.dev = kwargs["dev"]
            del kwargs["dev"]
        else:
            self.dev = False

        if self.dev:
            self.conf = DEFAULT_DEV.copy()
        else:
            self.conf = DEFAULT.copy()

        print(self.conf)

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