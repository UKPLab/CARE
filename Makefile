#!make
include .env
export

.PHONY: default
default: help

.PHONY: help
help:
	@echo "make help              Show this help message"
	@echo "make dev               Run the app in the development server"
	@echo "make h_server          Build Framework Hypothesis Server"
	@echo "make h_client          Build Framework Hypothesis Client"
	@echo "make build             Create a production build of the client"
	@echo "make clean             Delete development files"
	@echo "make docker			  Generate docker images"
	@echo "make init              Auto-Config h server"
	@echo "make nlp_dev           Run the flask app. Requires you to run make services in another terminal first"
	@echo "make nlp_services      Run required services"


.PHONY: dev
dev: frontend_dev nlp_dev

.PHONY: frontend_dev
frontend_dev: node_modules/.uptodate backend/node_modules/.uptodate
ifeq (,$(wildcard frameworks/hypothesis/client/build/manifest.json))
	@echo "Building h_client..."
	make h_client
endif
	npm run frontend-dev-build
	cd backend && npm run backend-dev

.PHONY: clean
clean:
	rm -f node_modules/.uptodate
	rm -f backend/node_modules/.uptodate
	rm -rf dist
	cd frameworks/hypothesis/client && make clean
	rm -r nlp/grobid_client_python

.PHONY: build
build:
	docker-compose -f docker-compose.yml up --build

node_modules/.uptodate: package.json package-lock.json
	npm install
	@touch $@

backend/node_modules/.uptodate: backend/package.json backend/package-lock.json
	cd backend && npm install
	@touch $@

.PHONY: h_server
h_server: frameworks/hypothesis/h/package.json
	docker-compose up postgres \
	                  elasticsearch \
	                  rabbit \
	                  h_server

.PHONY: h_client
h_client: frameworks/hypothesis/client/package.json
	cd frameworks/hypothesis/client && make build

.PHONY: services
services: h_services nlp_services

.PHONY: h_services
h_services:
	cd frameworks/hypothesis/h && make services


.PHONY: init
init: node_modules/.uptodate
	cd frameworks/hypothesis/h && tox -qe dev -- sh bin/hypothesis --dev init
	cd backend && npm run init-db -- \
				   --admin_name ${H_SERVER_ADMIN_USER} \
				   --admin_email ${H_SERVER_ADMIN_MAIL} \
				   --admin_pwd ${H_SERVER_ADMIN_PASSWORD}
	cd frameworks/hypothesis/h && tox -qe dev -- sh bin/hypothesis --dev user password ${H_SERVER_ADMIN_USER} --password ${H_SERVER_ADMIN_PASSWORD}


.PHONY: nlp_dev
nlp_dev:
	export PYTHON_PATH="$(CURDIR)/nlp/src"
	python3 ./nlp/src/app.py --dev


.PHONY: nlp_celery
nlp_celery:
	export C_FORCE_ROOT=true
	cd ./nlp/src && \
	celery --app app.celery worker -l INFO -E



.PHONY: nlp_services
nlp_services:
	docker-compose up grobid \
 					  rabbitmq \
 					  redis \
 					  celery-worker
