#!make
include .env  #default env
ifdef ENV
	include .env.${ENV}
endif
export

.PHONY: default
default: help

.PHONY: help
help:
	@echo "make help             		 		Show this help message"
	@echo "make dev             		  		Run in development mode (only unix)"
	@echo "make doc 							Build the documentation"
	@echo "make dev-build       		  		Build the frontend (make dev-build-frontend) and run the backend in development mode"
	@echo "make dev-backend      		 		Run backend in development mode"
	@echo "make dev-frontend     		 		Run frontend in development mode"
	@echo "make dev-build-frontend   		 	Build frontend in development mode"
	@echo "make build-frontend                  Build frontend in production mode"
	@echo "make test							Run unit tests (backend only)"
	@echo "make init             		 		Init (migrating) the database"
	@echo "make build           		  		Create a dockerized production build including frontend, backend, nlp, services"
	@echo "make build-clean                     Clean the environment of production build"
	@echo "make docker          				Start docker images"
	@echo "make backup_db CONTAINER=<name/id>	Backup the database in the given container"
	@echo "make recover_db CONTAINER=<name/id>  DUMP=<name in db_dumps folder>	Recover database into container"
	@echo "make clean             				Delete development files"
	@echo "make lint             				Run linter (only frontend)"
	@echo "make kill             				Kill all node instances (only unix)"

.PHONY: doc
doc: doc_asyncapi doc_sphinx

.PHONY: doc_asyncapi
doc_asyncapi:
	@echo "Building asyncapi documentation"
	@docker run --rm -v ${CURDIR}/docs/api.yml:/app/api.yml -v ${CURDIR}/docs/api:/app/output asyncapi/generator:1.14.0 --force-write -o ./output api.yml @asyncapi/html-template

.PHONY: doc_sphinx
doc_sphinx:
	@echo "Building sphinx documentation"
	@docker-compose -f docker-compose.yml --env-file ".env" build docs_sphinx
	@docker run --rm -v ${CURDIR}/docs:/docs docs_sphinx make html

.PHONY: doc_clean
doc_clean:
	@echo "Clean sphinx documentation"
	@docker-compose -f docker-compose.yml --env-file ".env" build docs_sphinx
	@docker run --rm -v ${CURDIR}/docs:/docs docs_sphinx make clean

.PHONY: test
test: backend/node_modules/.uptodate
	cd backend && npm run test

.PHONY: lint
lint: frontend/node_modules/.uptodate
	cd frontend && npm run frontend-lint

.PHONY: docker
docker:
	docker-compose -f docker-compose.yml -f docker-dev.yml up postgres

.PHONY: init
init: backend/node_modules/.uptodate
	@echo ${POSTGRES_HOST}
	cd backend/db && npx sequelize-cli db:create || echo "IGNORING ERROR"
	cd backend/db && npx sequelize-cli db:migrate

.PHONY: dev
dev: frontend/node_modules/.uptodate backend/node_modules/.uptodate
	cd frontend && npm run frontend-dev & cd backend && npm run start

.PHONY: dev-frontend
dev-frontend: frontend/node_modules/.uptodate
	cd frontend && npm run frontend-dev

.PHONY: dev-build
dev-build: backend/node_modules/.uptodate build-frontend
	cd backend && npm run start

.PHONY: dev-backend
dev-backend: backend/node_modules/.uptodate
	cd backend && npm run start

.PHONY: dev-build-frontend
dev-build-frontend: frontend/node_modules/.uptodate
	cd frontend && npm run frontend-dev-build

.PHONY: build
build:
	docker-compose -f docker-compose.yml -p ${PROJECT_NAME} up --build -d

.PHONE: build-frontend
build-frontend: frontend/node_modules/.uptodate
	cd frontend && npm run frontend-build

.PHONY: build-clean
build-clean:
	@echo "Cleaning project code and database. WARNING: This will remove your current DB state."
	docker-compose -p ${PROJECT_NAME} rm  -f -s -v
	docker network rm ${PROJECT_NAME}_default || echo "IGNORING ERROR"

.PHONY: backup_db
backup_db:
	@echo "Backing up database"
	mkdir -p db_dumps
	docker exec -t $${CONTAINER} pg_dumpall -c -U postgres > db_dumps/dump_`date +%d-%m-%Y"_"%H_%M_%S`.sql

.PHONY: recover_db
recover_db:
	@echo "Recovering database from dump. WARNING: This will override your current DB state."
	@echo "Recovering from $${DUMP}"
	@echo "Recovering int container $${CONTAINER}"
	cat "db_dumps/$${DUMP}" | docker exec -i $${CONTAINER} psql -U postgres

.PHONY: check_clean clean
check_clean:
	@echo -n "Are you sure? This will wipe out the entire database [y/N] " && read ans && [ $${ans:-N} = y ]

clean: check_clean
	@echo "Cleaning project code and database. WARNING: This will remove your current DB state."
	rm -f frontend/node_modules/.uptodate
	rm -f backend/node_modules/.uptodate
	rm -rf dist
	find files -maxdepth 1 -type f ! -name "8852a746-360e-4c31-add2-4d1c75bfb96d.pdf" -exec rm {} \;
	docker-compose rm -f -s -v
	docker network rm care_default || echo "IGNORING ERROR"

.PHONY: check_kill
check_kill:
	@echo -n "Are you sure? This will kill node instances running on your system! [y/N] " && read ans && [ $${ans:-N} = y ]

.PHONY: kill
kill: check_kill
	killall node

frontend/node_modules/.uptodate: frontend/package.json frontend/package-lock.json
	cd frontend && npm install
ifeq ($(OS),Windows_NT)
	type NUL > $@
else
	@touch $@
endif

backend/node_modules/.uptodate: backend/package.json backend/package-lock.json
	cd backend && npm install
ifeq ($(OS),Windows_NT)
	type NUL > $@
else
	@touch $@
endif
