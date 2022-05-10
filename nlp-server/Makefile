#!make
include .env
export

.PHONY: default
default: help

.PHONY: help
help:
	@echo "make help              Show this help message"
	@echo "make dev               Run the flask app. Requires you to run make services in another terminal first"
	@echo "make services		  Run required services"
	@echo "make docker			  Generate docker images"
	@echo "make init              Download and install required code to run the service in dev mode"

.PHONY: dev
dev:
	export PYTHON_PATH="$(CURDIR)/src"
	python3 src/app.py --dev

.PHONY: celery
celery:
	export C_FORCE_ROOT=true
	cd src && \
	celery --app app.celery worker -l INFO -E

.PHONY: services
services:
	docker-compose up grobid \
 					  rabbitmq \
 					  redis \
 					  celery-worker


.PHONY: docker
docker:
	docker-compose up  --build

.PHONY: clean
clean:
	rm -r grobid_client_python
	docker image prune -a




