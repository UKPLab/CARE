import logging
import os
import requests

import eventlet
import socketio


if __name__ == '__main__':
    print("Setting up logger to level {}...".format(os.getenv("LOG_LEVEL")))
    logging.basicConfig(level=logging.INFO)

    # create a Socket.IO server
    sio = socketio.Server(async_mode='eventlet')
    app = socketio.WSGIApp(sio)

    # todo fix bug with startup

    @sio.event
    def connect(sid, environ, auth):
        logging.info(f"Connection established with {sid}")

    @sio.on("call")
    def call(data):
        sio.emit("results", {"jobID": data['jobID']})

    eventlet.wsgi.server(eventlet.listen(("", 8080), app))
