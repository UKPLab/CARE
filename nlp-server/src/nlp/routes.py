from flask import session, request
from . import main


@main.route('/', methods=['GET', 'POST'])
def index():
    return "test"