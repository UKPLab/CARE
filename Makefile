#!make
include .env
export

.PHONY: default
default: help

.PHONY: help
help:
	@echo "make help             		 		Show this help message"
	@echo "make dev             		  		Run the app in the development environment"
	@echo "make dev-build       		  		Run the app with a build version of the frontend"
	@echo "make dev-backend      		 		Run only the backend with already builded frontend"
	@echo "make init             		 		Initializes command"
	@echo "make build           		  		Create a production build of the client"
	@echo "make build-frontend   		 		Only build frontend for backend-dev development"
	@echo "make docker          				Start docker images"
	@echo "make backup_db CONTAINER=<name/id>	Backup the database in the given container"
	@echo "make recover_db CONTAINER=<name/id> DUMP=<name in db_dumps folder>	Recover database into container"
	@echo "make clean             Delete development files"
	@echo "make nlp_dev           Run the flask app. Requires you to run make services in another terminal first"
	@echo "make nlp_services      Run required services"

.PHONY: dev
dev: node_modules/.uptodate backend/node_modules/.uptodate
	npm run frontend-dev & cd backend && npm run backend-dev

.PHONY: dev-build
dev-build: backend/node_modules/.uptodate build-frontend
	cd backend && npm run backend-dev

.PHONY: dev-backend
dev-backend: backend/node_modules/.uptodate
	cd backend && npm run backend-dev

.PHONY: build-frontend
build-frontend: node_modules/.uptodate
	npm run frontend-dev-build

.PHONY: build
build:
	docker-compose -f docker-compose.yml up --build

.PHONY: docker
docker:
	docker-compose up postgres

.PHONY: backup_db
backup_db:
	@echo "Backing up database"
	mkdir -p db_dumps
	docker exec -t $${CONTAINER} pg_dumpall -c -U postgres > db_dumps/dump_`date +%d-%m-%Y"_"%H_%M_%S`.sql

.PHONY: recover_db
recover_db:
	@echo "Recovering database from dump. WARNING: This will override your current DB state."
	cat "db_dumps/$${DUMP}" | docker exec -i $${CONTAINER} psql -U postgres

.PHONY: check_clean clean
check_clean:
	@echo -n "Are you sure? This will wipe out the entire database [y/N] " && read ans && [ $${ans:-N} = y ]

clean: check_clean
	@echo "Cleaning project code and database. WARNING: This will remove your current DB state."
	rm -f node_modules/.uptodate
	rm -f backend/node_modules/.uptodate
	rm -rf dist
	docker-compose rm -f -s -v
	docker network rm peer_default
	rm -r nlp/grobid_client_python

.PHONY: init
init: backend/node_modules/.uptodate
	cd backend/db && npx sequelize-cli db:create || echo "IGNORING ERROR"
	cd backend/db && npx sequelize-cli db:migrate

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
