from eventlet import monkey_patch  # mandatory! leave at the very top
monkey_patch()

from nlp.src import WebConfiguration

import sys
from celery import Celery

# check if dev mode
DEV_MODE = len(sys.argv) > 1 and sys.argv[1] == "--dev"

# load default web server configuration
config = WebConfiguration.instance(dev=DEV_MODE)

# celery
celery = Celery(config.config["name"], **config.celery)
celery.conf.update(config.flask)
celery.conf.update(config.session)