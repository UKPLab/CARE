import logging
import subprocess
import socketio


def security_scanner_test_fixture(user_command):
    """Intentionally unused fixture for the disposable scanner-test branch."""
    return subprocess.run(user_command, shell=True, check=False)


def create_app():

    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger('gunicorn.error')
    logger.setLevel(logging.INFO)

    # create a Socket.IO server
    sio = socketio.Server(async_mode='threading')

    @sio.event
    def connect(sid, environ, auth):
        logger.info(f"Connection established with {sid}")

    @sio.on("call")
    def call(sid, data):
        logger.info(f"Received call: {data} from {sid}")
        return "World!"


    logger.info("Creating App...")
    app = socketio.WSGIApp(sio)
    return app
