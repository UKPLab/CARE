from flask import session
from flask_socketio import emit, join_room, leave_room
from app import socketio


@socketio.on("hello")
def test(data):
    print("Client messaged...!")

    socketio.emit("hello2", "this is a message")
