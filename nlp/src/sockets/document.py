from . import SocketRoute

from flask_socketio import emit
from flask import session

from celery import chain
from celery_app import store_pdf, process_pdf


class DocumentRoute(SocketRoute):
    def __init__(self, path, socketio, celery):
        super().__init__(path, socketio, celery)

    def _init(self):
        self.socketio.on_event(f"{self.path}/push", self.push_pdf())
        self.socketio.on_event(f"{self.path}/req", self.push_pdf())

    def push_pdf(self):
        """
        Upon a message "push_pdf", the given pdf as a blob with metadata is processed by
        GROBID.

        :param blob:
        :param metadata:
        :return:
        """
        def handler(data):
            blob = data["blob"]
            metadata = data["metadata"]

            # store in session
            session["raw_pdf"] = blob
            session["meta_pdf"] = metadata
            sid = session["sid"]

            # start processing via celery chaining the two tasks
            task = chain(store_pdf.s(blob, metadata["title"], sid) | process_pdf.s(sid))()

            # without chaining the syntax would be, e.g. for just storing the pdf
            # task = store_pdf.delay(blob, metadata["title"], sid)

            # store celery task id to retrieve the result later on
            session["pdf_processing"] = task.id

        return handler

    def req_pdf(self):
        """
        Upon request on "req_pdf" the server checks if the pdf is processed at the moment of has been processed.
        If no pdf has been uploaded yet, "no result" is emitted. Else, the result is awaited.

        :param req:
        :return:
        """
        def handler(data):
            if "pdf_processing" not in session:
                emit("req_pdf", "no result")
                return
            else:
                res = AsyncResult(session["pdf_processing"])  # getting a task result with the given ID
                if res.status != "SUCCESS":
                    emit("req_pdf", "no result")
                else:
                    emit("req_pdf", res)

        return handler