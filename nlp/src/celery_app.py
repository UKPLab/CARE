import hashlib
import os

from eventlet import monkey_patch  # mandatory! leave at the very top
monkey_patch()

import WebConfiguration

import sys
from celery import Celery
from flask_socketio import SocketIO
from grobid_client.grobid_client import GrobidClient, ServerUnavailableException

# check if dev mode
DEV_MODE = len(sys.argv) > 1 and sys.argv[1] == "--dev"

# load default web server configuration
config = WebConfiguration.instance(dev=DEV_MODE)

# celery
celery = Celery("peer_nlp", **config.celery)
celery.conf.update(config.flask)
celery.conf.update(config.session)


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


@celery.task
def simple_task(input, sid):
    statussocket = SocketIO(message_queue=config.celery["broker"])

    print("Simple task -- inner workings")

    statussocket.emit("result_simple_task", "this is a celery result", room=sid)


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
    filepath = os.path.join(config['UPLOAD_FOLDER'], filename)

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
    statussocket = SocketIO(message_queue=app.config["broker"])

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