from eventlet import monkey_patch
monkey_patch()

from celery import Celery

from flask import Flask, jsonify, request
from flask_socketio import SocketIO
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = 'pssst!'
app.config['CELERY_RESULT_BACKEND'] = "rpc://rabbitmq:5672"  # todo use env variable, add user cred
app.config['CELERY_BROKER_URL'] = "amqp://guest:guest@rabbitmq:5672"

socketio = SocketIO()
socketio.init_app(app,
                  cors_allowed_origins='*',
                  message_queue=app.config['CELERY_BROKER_URL'],
                  logger=True,
                  engineio_logger=True)

celery = Celery(app.name,
                backend=app.config['CELERY_RESULT_BACKEND'],
                broker=app.config['CELERY_BROKER_URL']
                )
celery.conf.update(app.config)

clients = []

@celery.task
def printhello(data):
    print("Hello world!" + data)


@celery.task(bind=True)
def computehello_resviasocketio(self, data, session, clients):
    # instantiate a socketio interface on the worker
    socket = SocketIO(message_queue=app.config["CELERY_BROKER_URL"])
                      #channel=session) # if we have mutliple sockets in different apps (i assume)

    print(str(clients), str(session))

    parts = data.split(" ")
    print("hello" + "-".join(parts))
    print("clients" + str(clients))

    # testing bounded methods
    self.update_state(state='PROGRESS', meta={'current': 10, 'total': 100})

    res = 0
    for i in range(20):
        res += i
        time.sleep(0.5)

    res = "-".join(parts) + "_" + str(res)

    socket.emit("celery-result", res, room=session)

    clients.append("lalala")


@celery.task
def startworker():
    socket = SocketIO(message_queue=app.config["CELERY_BROKER_URL"])

    def do():
        print("connected to celery!")

    socket.on("connect", do)

    socket.emit("hello2", "hello there, you talk to celery")


@app.route("/test")
def test():
    print("/test being called... starting celery")
    task = printhello.delay("testdata")

    return jsonify({}), 202, {'Location': "lalala"}


@socketio.on("connect")
def connect():
    global clients

    print("Client connected..." + str(request.sid))
    clients += [request.sid]


@socketio.on("hello")
def test(data):
    print("Client messaged...!")

    print("clients " + str(clients))

    global clients
    task = computehello_resviasocketio.delay(data, request.sid, clients)

    socketio.emit("hello2", str(task), room=request.sid)


if __name__ == '__main__':
    socketio.run(app,
                 host="0.0.0.0",
                 debug=True,
                 port=6000)
