""" app -- Bootstrapping the server

This is the file used to start the flask (and socketio) server. It is also the file considered
by the celery client to setup RPCs to the celery server.

At the moment, the file contains examples to test your setup and get a feeling for how
celery + socketio can work together.

Author: Nils Dycke (dycke@ukp...)
"""
import flask
from eventlet import monkey_patch  # mandatory! leave at the very top

monkey_patch()

from ExampleNamespace import ExampleNamespace
import hashlib

from celery.result import AsyncResult

import os
from grobid_client.grobid_client import GrobidClient, ServerUnavailableException

from celery import Celery, chain
from flask import Flask, session, request
from flask_socketio import SocketIO, join_room, emit

import sys

import WebConfiguration

## CONFIGURE FLASK + SOCKETIO + CELERY

# check if dev mode
DEV_MODE = len(sys.argv) > 1 and sys.argv[1] == "--dev"

# load default web server configuration
config = WebConfiguration.instance(dev=DEV_MODE)

# flask server
app = Flask(__name__)
app.config.update(config.flask)
app.config.update(config.session)

# socketio
socketio = SocketIO(app, **config.socketio)

# celery
celery = Celery(app.name, **config.celery)
celery.conf.update(app.config)


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


def parse_pdf(filepath):
    """
    This auxiliary method instantiates a grobid client and sends a request to parse the given
    PDF on the filepath.

    :param filepath: filepath of the PDF to parse
    :return:
    """
    client = GrobidClient(**config.grobid)

    _, status, parsed = client.process_pdf("processFulltextDocument",
                                           filepath,
                                           generateIDs=False,
                                           consolidate_header=True,
                                           consolidate_citations=False,
                                           include_raw_citations=False,
                                           include_raw_affiliations=False,
                                           tei_coordinates=False,
                                           segment_sentences=False)

    return status, parsed


### CELERY #####################################
@celery.task
def store_pdf(raw_pdf, title, sid):
    """
    Celery task for storing a given PDF in raw binary format.

    :param raw_pdf: the binary pdf (pickled)
    :param title: the title of the PDF
    :param sid: the session id to respond to via socketio
    :return: the filepath where the pdf can be found
    """
    filename = hashlib.sha256((title + sid).encode("utf-8")).hexdigest() + ".pdf"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)

    with open(filepath, "wb+") as file:
        file.write(raw_pdf)

    return filepath


@celery.task
def process_pdf(raw_pdf_path, sid):
    """
    Celery task for processing a given PDF. The pdf is loaded from the passed file path,
    processed using grobid and an answer is emitted on the channel.

    You can chain this task with the store_pdf task to process a raw, binary pdf stream.

    :param raw_pdf_path: path to the pdf
    :param sid: the session id to respond to via socketio
    :return:the parsed result
    """
    statussocket = SocketIO(message_queue=app.config["CELERY_BROKER_URL"])

    # call grobid
    status, parsed = parse_pdf(raw_pdf_path)

    statussocket.emit("req_pdf", parsed, room=sid)

    # return result
    return parsed


@celery.task(bind=True)
def example_binded_method(self, input):
    # if you need to access app parameters (note: you cannot access the app itself, as celery processes are decoupled)
    with app.app_context():
        # do stuff
        ...

        # binded tasks allow to push updates on the state to the celery server (and hereby AsyncResult calls)
        self.update_state(state='PROGRESS', meta={'current': 10, 'total': 100})


### SOCKETIO ###################################
# creates an examplary socketio namespace. Connections to host:port/example will be forwarded to this point
socketio.on_namespace(ExampleNamespace("/example"))


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
def push_pdf(blob, metadata):
    """
    Upon a message "push_pdf", the given pdf as a blob with metadata is processed by
    GROBID.

    :param blob:
    :param metadata:
    :return:
    """
    # store in session
    session["raw_pdf"] = blob
    session["meta_pdf"] = metadata
    sid = session["sid"]

    # start processing via celery chaining the two tasks
    task = chain(store_pdf.s(blob, metadata["title"], sid) | process_pdf.s(sid))()

    # without chaining the syntax would be, e.g. for just storing the pdf
    # store_pdf.delay(blob, metadata["title"], sid)

    # store celery task id to retrieve the result later on
    session["pdf_processing"] = task.id


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
    pass


### FLASK ######################################

# add flask routes here (for now, until Blueprints are realized)
# at the moment there are not flask routes

#################################################


if __name__ == '__main__':
    # this method is called when starting the flask server, initializing it to listen to WS requests
    init()
    print("App running", config.app)
    socketio.run(app, **config.app)
    #app.run(**config.app)