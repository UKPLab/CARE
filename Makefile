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
	@echo "make dev             		  		Run the app in the development environment"
	@echo "make dev-build       		  		Run the app with a build version of the frontend"
	@echo "make dev-backend      		 		Run only the backend with already builded frontend"
	@echo "make dev-build-frontend   		 	Only build frontend for backend-dev development"
	@echo "make test-backend					Run backend tests"
	@echo "make test-fronted					Run frontend tests"
	@echo "make init             		 		Initializes command"
	@echo "make build           		  		Create a dockerized production build including frontend, backend, nlp, services"
	@echo "make build-frontend                  Build frontend in production mode"
	@echo "make build-clean                     Clean the environment of production build"
	@echo "make build-dev                       Also build, but dev environment with other ports!"
	@echo "make build-dev-clean                 Clean the dev build environment"
	@echo "make docker          				Start docker images"
	@echo "make backup_db CONTAINER=<name/id>	Backup the database in the given container"
	@echo "make recover_db CONTAINER=<name/id>  DUMP=<name in db_dumps folder>	Recover database into container"
	@echo "make clean             				Delete development files"

.PHONY: dev
dev: node_modules/.uptodate backend/node_modules/.uptodate
	npm run frontend-dev & cd backend && npm run start

.PHONY: dev-build
dev-build: backend/node_modules/.uptodate build-frontend
	cd backend && npm run start

.PHONY: dev-backend
dev-backend: backend/node_modules/.uptodate
	cd backend && npm run start

.PHONY: dev-build-frontend
dev-build-frontend: node_modules/.uptodate
	npm run frontend-dev-build

.PHONY: build
build:
	docker-compose -f docker-compose.yml -p "peer_main" --env-file ".env.main"  up --build -d

.PHONE: build-frontend
build-frontend: node_modules/.uptodate
	npm run frontend-build

.PHONE: test-frontend
test-frontend: node_modules/.uptodate
	npm run test

.PHONY: test-backend
test-backend: backend/node_modules/.uptodate
	cd backend && npm run test

.PHONY: build-dev
build-dev:
	docker-compose -f docker-compose.yml -p "peer_dev" --env-file ".env.dev"  up --build -d

.PHONY: build-clean
build-clean:
	@echo "Cleaning project code and database. WARNING: This will remove your current DB state."
	docker-compose -p "peer_main" rm  -f -s -v
	docker network rm peer_main_default

.PHONY: build-dev-clean
build-dev-clean:
	@echo "Cleaning project code and database. WARNING: This will remove your current DB state."
	docker-compose -p "peer_dev"  rm -f -s -v
	docker network rm peer_dev_default

.PHONY: docker
docker:
	docker-compose -f docker-dev.yml up postgres

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
	rm -f node_modules/.uptodate
	rm -f backend/node_modules/.uptodate
	rm -rf dist
	docker-compose rm -f -s -v
	docker network rm peer_default

.PHONY: init
init: backend/node_modules/.uptodate
	@echo ${POSTGRES_HOST}
	cd backend/db && npx sequelize-cli db:create || echo "IGNORING ERROR"
	cd backend/db && npx sequelize-cli db:migrate

node_modules/.uptodate: package.json package-lock.json
	npm install
	@touch $@

backend/node_modules/.uptodate: backend/package.json backend/package-lock.json
	cd backend && npm install
	@touch $@

