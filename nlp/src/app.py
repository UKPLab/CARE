""" app -- Bootstrapping the server

This is the file used to start the flask (and socketio) server. It is also the file considered
by the celery client to setup RPCs to the celery server.

At the moment, the file contains examples to test your setup and get a feeling for how
celery + socketio can work together.

Author: Nils Dycke (dycke@ukp...)
"""
from eventlet import monkey_patch  # mandatory! leave at the very top
monkey_patch()

from ExampleNamespace import ExampleNamespace

from celery.result import AsyncResult

from celery import chain
from flask import Flask, session, request
from flask_socketio import SocketIO, join_room, emit

from grobid_client.grobid_client import GrobidClient, ServerUnavailableException

import WebConfiguration

from celery_app import *

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
    ...


@socketio.on("push_pdf")
def push_pdf(input):
    """
    Upon a message "push_pdf", the given pdf as a blob with metadata is processed by
    GROBID.

    :param blob:
    :param metadata:
    :return:
    """
    blob = input["blob"]
    metadata = input["metadata"]

    # store in session
    session["raw_pdf"] = blob
    session["meta_pdf"] = metadata
    sid = session["sid"]

    # start processing via celery chaining the two tasks
    task = chain(store_pdf.s(blob, metadata["title"], sid) | process_pdf.s(sid))()

    # without chaining the syntax would be, e.g. for just storing the pdf
    #task = store_pdf.delay(blob, metadata["title"], sid)

    # store celery task id to retrieve the result later on
    session["pdf_processing"] = task.id


@socketio.on("simple_test")
def simple_test(input):
    sid = session["sid"]
    task = simple_task.delay(input, sid)

    session["simple_test_task"] = task


@socketio.on("req_pdf")
def req_pdf(req):
    """
    Upon request on "req_pdf" the server checks if the pdf is processed at the moment of has been processed.
    If no pdf has been uploaded yet, "no result" is emitted. Else, the result is awaited.

    :param req:
    :return:
    """
    if "pdf_processing" not in session:
        emit("req_pdf", "no result")
        return
    else:
        res = AsyncResult(session["pdf_processing"])  # getting a task result with the given ID
        if res.status != "SUCCESS":
            emit("req_pdf", "no result")
        else:
            emit("req_pdf", res)


@socketio.on("init_bot")
def init_bot(bot_config):
    """
    Place holder message listener as an example.

    :param bot_config:
    :return:
    """
    emit("init_bot_res", "resulty mcresult face")


### FLASK ######################################

# add flask routes here (for now, until Blueprints are realized)
# at the moment there are not flask routes

#################################################


if __name__ == '__main__':
    # this method is called when starting the flask server, initializing it to listen to WS requests
    init()
    print("App starting", config.app)
    socketio.run(app, **config.app, log_output=True)