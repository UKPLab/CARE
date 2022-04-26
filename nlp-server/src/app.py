from eventlet import monkey_patch
monkey_patch()

from TestClass import TestNamespace, Manager
import hashlib

from celery.result import AsyncResult

import os
from grobid_client.grobid_client import GrobidClient, ServerUnavailableException

from celery import Celery, chain
from flask import Flask, session, request
from flask_socketio import SocketIO, join_room, emit

import WebConfiguration

# load default web server configuration
config = WebConfiguration.instance()

# flask server
app = Flask(__name__)
app.config.update(config.flask)
app.config.update(config.session)

# socketio
socketio = SocketIO(app, **config.socketio)
# socketio.init_app(app, **config.socketio)

# celery
celery = Celery(app.name, **config.celery)
celery.conf.update(app.config)

####### To be moved into sub-directories ########
## use Blueprint for flask
## use Namespace for socketio combine with flask sessions and only use emit importet from socketio
#### /doc
####
## use celery task registry for celery tasks

def init():
    # update config
    app.config.update(config.grobid)

    # check connection to GROBID (ignore object, use just the test)
    try:
        GrobidClient(**config.grobid)
        print("SUCCESS: GROBID client reached GROBID server")
    except ServerUnavailableException as e:
        print("WARNING: GROBID server seems unavailable for the given config. Probably cannot process PDFs!")
        print(e)

    # check file system
    if not os.path.exists(app.config["UPLOAD_FOLDER"]) or not os.path.isdir(app.config["UPLOAD_FOLDER"]):
        print("Creating temporary file storage directory at %s" % app.config["UPLOAD_FOLDER"])
        os.mkdir(app.config["UPLOAD_FOLDER"])


def parse_pdf(filepath):
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
    filename = hashlib.sha256((title + sid).encode("utf-8")).hexdigest() + ".pdf"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)

    with open(filepath, "wb+") as file:
        file.write(raw_pdf)

    return filepath


@celery.task
def process_pdf(raw_pdf_path, sid):
    statussocket = SocketIO(message_queue=app.config["CELERY_BROKER_URL"])

    # call grobid
    status, parsed = parse_pdf(raw_pdf_path)

    statussocket.emit("req_pdf", parsed, room=sid)

    # return result
    return parsed


### SOCKETIO ###################################
socketio.on_namespace(TestNamespace("/test"))

@socketio.on("connect")
def connect(data):
    print("new Connection to websocket ...")
    print(data)
    sid = request.sid
    session["sid"] = sid
    join_room(sid)

    session["mng"] = Manager()

    return sid


@socketio.on("disconnect")
def disconnect():
    #terminate running jobs
    #clear pending results
    #clear session
    ...


@socketio.on("push_pdf")
def push_pdf(blob, metadata):
    # store in session
    session["raw_pdf"] = blob
    session["meta_pdf"] = metadata
    sid = session["sid"]

    # start processing
    task = chain(store_pdf.s(blob, metadata["title"], sid) | process_pdf.s(sid))()
    session["pdf_processing"] = task.id

@socketio.on("req_pdf")
def req_pdf(req):
    if "pdf_processing" not in session:
        emit("req_pdf", "no result")
        return
    else:
        res = AsyncResult(session["pdf_processing"])
        if res.status != "SUCCESS":
            emit("req_pdf", "no result")
        else:
            emit("req_pdf", res)

@socketio.on("push_xml")
def push_mapping(xml, metadata):
    raise NotImplementedError()


@socketio.on("init_bot")
def init_bot(bot_config):
    pass

@socketio.on("classify_doc")
def classify_doc():
    pass

@socketio.on("classify_anno")
def push_anno(annotation):
    ...

### FLASK ######################################
#nothing, for now

#################################################

if __name__ == '__main__':
    init()
    socketio.run(app, **config.app)
