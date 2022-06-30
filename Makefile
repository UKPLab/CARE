#!make
include .env
export

.PHONY: default
default: help

.PHONY: help
help:
	@echo "make help              Show this help message"
	@echo "make dev               Run the app in the development server"
	@echo "make build             Create a production build of the client"
	@echo "make docker            Start docker images"
	@echo "make clean             Delete development files"
	@echo "make nlp_dev           Run the flask app. Requires you to run make services in another terminal first"
	@echo "make nlp_services      Run required services"

.PHONY: dev
dev: node_modules/.uptodate backend/node_modules/.uptodate
	npm run frontend-dev-build
	cd backend && npm run backend-dev

dev2: node_modules/.uptodate backend/node_modules/.uptodate
	npm run frontend-dev

.PHONY: build
build:
	docker-compose -f docker-compose.yml up --build

.PHONY: docker
docker:
	docker-compose up postgres

.PHONY: clean
clean:
	rm -f node_modules/.uptodate
	rm -f backend/node_modules/.uptodate
	rm -rf dist
	docker-compose rm -f -s -v
	docker network rm peer_default
	rm -r nlp/grobid_client_python

.PHONY: init
init: node_modules/.uptodate backend/node_modules/.uptodate
	cd backend && npm run init-db -- \
				   --admin_name ${H_SERVER_ADMIN_USER} \
				   --admin_email ${H_SERVER_ADMIN_MAIL} \
				   --admin_pwd ${H_SERVER_ADMIN_PASSWORD}

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

node_modules/.uptodate: package.json package-lock.json
	npm install
	@touch $@

backend/node_modules/.uptodate: backend/package.json backend/package-lock.json
	cd backend && npm install
	@touch $@
