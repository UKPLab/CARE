import logging
import socketio


def create_app():

    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger('gunicorn.error')
    logger.setLevel(logging.INFO)

    # create a Socket.IO server
    sio = socketio.Server(async_mode='threading')

    @sio.event
    def connect(sid, environ, auth):
        logger.info(f"Connection established with {sid}")

    @sio.on("healthy")
    def healthy(sid, data):
        logger.info(f"Health check from {sid}")
        return {"success": True, "data": "World!"}


    logger.info("Creating App...")
    app = socketio.WSGIApp(sio)
    return app
