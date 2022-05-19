import time
import unittest
import socketio


class TestSocketIO(unittest.TestCase):
    def test_connect(self):
        sio = socketio.Client()
        sio.connect("http://localhost:6000")
        connected = sio.sid is not None
        sio.disconnect()

        self.assertTrue(connected)

    def test_simple_message(self):
        result = []

        def set_result(r):
            nonlocal result
            result += [r]

        sio = socketio.Client()
        sio.on("celery-result", set_result)

        sio.connect("http://localhost:6000")
        connected = sio.sid is not None
        sio.emit("hello", "testdata")
        time.sleep(20)

        self.assertTrue(len(result) == 1)

        sio.disconnect()

        self.assertTrue(connected)


if __name__ == '__main__':
    unittest.main()
