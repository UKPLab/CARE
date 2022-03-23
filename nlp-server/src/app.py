from eventlet import monkey_patch #crucial! else won't work
monkey_patch()

from celery import Celery

from flask import Flask, jsonify, request, session
from flask_socketio import SocketIO
from flask_session import Session
import time
import redis

app = Flask(__name__)
app.config['SECRET_KEY'] = 'pssst!'
app.config['CELERY_RESULT_BACKEND'] = "redis://redis:6379" # old "rpc://rabbitmq:5672"  # todo use env variable, add user cred
app.config['CELERY_BROKER_URL'] = "amqp://guest:guest@rabbitmq:5672"

app.config['SESSION_TYPE'] = 'redis'
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_USE_SIGNER'] = True
app.config['SESSION_REDIS'] = redis.from_url("redis://redis:6379")

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

server_session = Session(app)

@celery.task
def printhello(data):
    print("Hello world!" + data)


@celery.task(bind=True)
def computehello_resviasocketio(self, data, sid):
    with app.app_context():
        # instantiate a socketio interface on the worker
        socket = SocketIO(message_queue=app.config["CELERY_BROKER_URL"])
                          #channel=session) # if we have mutliple sockets in different apps (i assume)

        parts = data.split(" ")
        print("hello" + "-".join(parts))

        # testing bounded methods
        self.update_state(state='PROGRESS', meta={'current': 10, 'total': 100})

        res = 0
        for i in range(20):
            res += i
            time.sleep(0.5)

        res = "-".join(parts) + "_" + str(res)

        socket.emit("celery-result", res, room=sid)

        return res


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
    print("Client connected..." + str(request.sid))


@socketio.on("hello")
def test(data):
    print("Client messaged...!")

    if "c" not in session:
        session["c"] = []

    task = computehello_resviasocketio.delay(data, request.sid)

    if "state" not in session:
        session["state"]=[]
    session["state"] += ["hello received"]

    socketio.emit("hello2", str(task) + str(session["state"]), room=request.sid)


if __name__ == '__main__':
    socketio.run(app,
                 host="0.0.0.0",
                 debug=True,
                 port=6000)
