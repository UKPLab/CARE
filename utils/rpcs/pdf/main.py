import os
import logging
import socketio
import pymupdf

__author__ = "Karim Ouf"

def create_app():
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger('gunicorn.error')
    logger.setLevel(logging.INFO)

    sio = socketio.Server(async_mode='threading')

    @sio.event
    def connect(sid, environ, auth):
        logger.info(f"Connection established with {sid}")

    @sio.on("call")
    def call(sid, data):
        logger.info(f"Received call: {data} from {sid}")
        try:
            response = {"success": True, "data": "Hello World!"}
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            response = {"success": False, "message": "error: " + str(e)}
            return response

    @sio.on("test")
    def test(sid, data):
        logger.info(f"Received call: {data} from {sid}")
        try:
            doc_hash = data["document"]["hash"]
            target = os.path.join("uploads", f"{doc_hash}.pdf")
            with open(target, "wb") as f:
                f.write(data["file"])
            doc = pymupdf.open(target)
            response = {"success": True, "message": "PDF read successfully"}
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            response = {"success": False, "message": "error: " + str(e)}
            return response

    @sio.on("annotations")
    def annotations(sid, data):
        logger.info(f"Received call: {data} from {sid}")
        try:
            doc_hash = data["document"]["hash"]
            target = os.path.join("uploads",  f"{doc_hash}.pdf")
            with open(target, "wb") as f:
                f.write(data["file"])
            doc = pymupdf.open(target)
            annotations = []
            for page in doc:
                for annot in page.annots():
                    annotations.append({
                        "page": page.number,
                        "type": annot.type,
                        "rect": annot.rect
                    })
            response = {"success": True, "data": annotations}
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            response = {"success": False, "message": "error: " + str(e)}
            return response

    #       create

    # @sio.on("emmbedAnnotations")
    # def embed_file(sid, data):
    #     logger.info(f"Received call: {data} from {sid}")
    #     try:
    #         doc_hash = data["document"]["hash"]
    #         target = os.path.join("uploads", f"{doc_hash}.pdf")
    #         with open(target, "wb") as f:
    #             f.write(data["file"])
    #         doc = pymupdf.open(target)
    #         embedded_data = data["embedded_data"]
    #         doc.save()
    #         response = {"success": True, "message": "PDF read successfully"}
    #         return response
    #     except Exception as e:
    #         logger.error(f"Error: {e}")
    #         response = {"success": False, "message": "error: " + str(e)}
    #         return response

    logger.info("Creating App...")
    app = socketio.WSGIApp(sio)
    return app

    def embed