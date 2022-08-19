""" app -- Bootstrapping the server

This is the file used to start the flask (and socketio) server. It is also the file considered
by the celery client to setup RPCs to the celery server.

At the moment, the file contains examples to test your setup and get a feeling for how
celery + socketio can work together.

Author: Nils Dycke (dycke@ukp...)
"""
from eventlet import monkey_patch  # mandatory! leave at the very top
monkey_patch()

from celery.result import AsyncResult

from flask import Flask, session, request
from flask_socketio import SocketIO, join_room, emit

from grobid_client.grobid_client import GrobidClient, ServerUnavailableException

import WebConfiguration

from celery_app import *

from sockets.test import TestRoute
from sockets.document import DocumentRoute
from sockets.report import ReportRoute

# load default web server configuration
DEV_MODE = len(sys.argv) > 1 and sys.argv[1] == "--dev"
config = WebConfiguration.instance(dev=DEV_MODE)

# flask server
app = Flask("peer_nlp")
app.config.update(config.flask)
app.config.update(config.session)
app.config.update(config.celery)  # necessary as we access the broker information later on

# socketio
socketio = SocketIO(app, **config.socketio)


def init():
    """
    Initialize the flask app and check for the connection to the GROBID client.
    :return:
    """
    # update config
    app.config.update(config.grobid)

    # check connection to GROBID (ignore object, use just the test)
    try:
        GrobidClient(**config.grobid)
        print("SUCCESS: GROBID client reached GROBID server")
    except ServerUnavailableException as e:
        print("WARNING: GROBID server seems unavailable for the given config. Probably cannot process PDFs!")
        print(e)

### SOCKETIO ###################################

@socketio.on("connect")
def connect(data):
    """
    Example connection event. Upon connection on "/" the sid is loaded, stored in the session object
    and the connection is added to the room of that SID to enable an e2e connection.

    :return: the sid of the connection
    """
    print("new Connection to websocket ...")
    print(data)
    sid = request.sid
    session["sid"] = sid
    join_room(sid)

    return sid


@socketio.on("disconnect")
def disconnect():
    """
    Place holder for disconnection event.

    :return:
    """
    # terminate running jobs
    # clear pending results
    # clear session
    print("Disconnected!")


# add socket routes
TestRoute("test", socketio)
DocumentRoute("pdf", socketio, celery)
ReportRoute("report", socketio, celery)

### FLASK ######################################

# add flask routes here (for now, until Blueprints are realized)
# at the moment there are not flask routes

#################################################


if __name__ == '__main__':
    # this method is called when starting the flask server, initializing it to listen to WS requests
    init()
    print("App starting", config.app)
    socketio.run(app, **config.app, log_output=True)