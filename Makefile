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
	@echo "make dev             		  		Run in development mode, skipping the first-time setup wizard (only unix)"
	@echo "make dev-wizard         		  		Run dev mode and go through the first-time setup wizard"
	@echo "make doc 							Build the documentation"
	@echo "make dev-build       		  		Build the frontend (make dev-build-frontend) and run the backend in development mode"
	@echo "make dev-backend      		 		Run backend in development mode"
	@echo "make dev-backend-wizard            	Run backend in development mode with setup wizard enabled"
	@echo "make dev-backend-watch  			    Run backend in development mode with nodemon (auto-restart)"
	@echo "make dev-frontend     		 		Run frontend in development mode"
	@echo "make dev-build-frontend   		 	Build frontend in development mode"
	@echo "make build-frontend                  Build frontend in production mode"
	@echo "make test							Run unit tests (backend only)"
	@echo "make test-modules                    Run unit tests for specific modules"
	@echo "make db             		 			Init (migrating) the database"
	@echo "make init           		  			Init (migrating) the database and install npm packages in all utils/modules subdirectories"
	@echo "make build           		  		Create a dockerized production build including frontend, backend, nlp, services"
	@echo "make build-clean                     Clean the environment of production build"
	@echo "make docker          				Start docker images"
	@echo "make docker-recompose 				Rebuild and start the dev Docker stack (postgres, rpc_*)"
	@echo "make backup_db CONTAINER=<name/id>	Backup the database in the given container"
	@echo "make recover_db CONTAINER=<name/id>  DUMP=<name in db_dumps folder>	Recover database into container"
	@echo "make anonymize_dump CONTAINER=<name/id>  DUMP=<name in db_dumps folder>  [SEED=<int>]  [NUM=<int>]	Create anonymized dump (consent-filtered + pseudonymized)"
	@echo "make export_dump_files CONTAINER=<name/id>  DUMP=<name in db_dumps folder>	Archive document files referenced by an existing anonymized dump"
	@echo "make clean             				Delete development files"
	@echo "make lint             				Run linter (only frontend)"
	@echo "make kill             				Kill all node instances (only unix)"
	@echo "make modules          				Install npm packages in all utils/modules subdirectories"
	@echo "make audit            				npm audit for frontend, backend, and utils/modules packages"

.PHONY: doc
doc: doc_sphinx

.PHONY: doc_sphinx
doc_sphinx:
	@echo "Building sphinx documentation"
	@docker compose -f docker-compose.yml --env-file ".env" build docs_sphinx
	@docker run --rm -v ${CURDIR}/docs:/docs -v ${CURDIR}/backend:/backend docs_sphinx make html
	
.PHONY: doc_clean
doc_clean:
	@echo "Clean sphinx documentation"
	@docker compose -f docker-compose.yml --env-file ".env" build docs_sphinx
	@docker run --rm -v ${CURDIR}/docs:/docs docs_sphinx make clean

.PHONY: test
test: backend/node_modules/.uptodate
	cd backend && npm run test

.PHONY: test-rpc
test-rpc: backend/node_modules/.uptodate
	cd backend && npm run test_rpc

.PHONY: test-modules
test-modules:
	cd utils/modules/editor-delta-conversion && npm run test:module -- tests/editor-delta-conversion.test.js
	cd utils/modules/assessment-score && npm run test:module -- tests/assessment-score.test.js

.PHONY: lint
lint: frontend/node_modules/.uptodate
	cd frontend && npm run frontend-lint

.PHONY: docker
docker:
	@docker compose -f docker-compose.yml -f docker-dev.yml up postgres rpc_test rpc_moodle rpc_pdf rpc_litellm

.PHONY: docker-recompose
docker-recompose:
	@docker compose -f docker-compose.yml -f docker-dev.yml up --build postgres rpc_test rpc_moodle rpc_pdf rpc_litellm

.PHONY: db
db: backend/node_modules/.uptodate
	@echo ${POSTGRES_HOST}
	cd backend/db && npx sequelize-cli db:create || echo "IGNORING ERROR"
	cd backend/db && npx sequelize-cli db:migrate

.PHONY: init
init: modules db

.PHONY: dev
dev: frontend/node_modules/.uptodate backend/node_modules/.uptodate
	cd frontend && npm run frontend-dev & cd backend && DEV_SKIP_WIZARD=true npm run start

.PHONY: dev-wizard
dev-wizard: frontend/node_modules/.uptodate backend/node_modules/.uptodate
	cd frontend && npm run frontend-dev & cd backend && npm run start

.PHONY: dev-frontend
dev-frontend: frontend/node_modules/.uptodate
	cd frontend && npm run frontend-dev

.PHONY: dev-build
dev-build: backend/node_modules/.uptodate build-frontend
	cd backend && npm run start

.PHONY: dev-backend
dev-backend: DEV_SKIP_WIZARD=true
dev-backend: backend/node_modules/.uptodate
	cd backend && npm run start 

.PHONY: dev-backend-wizard
dev-backend-wizard: backend/node_modules/.uptodate
	cd backend && npm run start

.PHONY: dev-backend-watch
dev-backend-watch: DEV_SKIP_WIZARD=true
dev-backend-watch: backend/node_modules/.uptodate
	cd backend && npm run start:watch

.PHONY: dev-build-frontend
dev-build-frontend: frontend/node_modules/.uptodate
	cd frontend && npm run frontend-dev-build

.PHONY: build
build:
	@docker compose -f docker-compose.yml -p ${PROJECT_NAME} up --build -d

.PHONY: build-frontend
build-frontend: frontend/node_modules/.uptodate
	cd frontend && npm run frontend-build

.PHONY: rpc_moodle_build
rpc_moodle_build:
	docker compose -f docker-compose.yml -f docker-dev.yml build rpc_moodle
	docker compose -f docker-compose.yml -f docker-dev.yml up -d rpc_moodle

.PHONY: build-clean
build-clean:
	@echo "Cleaning project code and database. WARNING: This will remove your current DB state."
	@docker compose -p ${PROJECT_NAME} rm  -f -s -v
	@docker network rm ${PROJECT_NAME}_default || echo "IGNORING ERROR"

.PHONY: backup_db
backup_db:
	@echo "Backing up database"
	mkdir -p db_dumps
	@docker exec -t $${CONTAINER} pg_dumpall -c -U postgres > db_dumps/dump_`date +%d-%m-%Y"_"%H_%M_%S`.sql

.PHONY: recover_db
recover_db:
	@echo "Recovering database from dump. WARNING: This will override your current DB state."
	@echo "Recovering from $${DUMP}"
	@echo "Recovering into container $${CONTAINER}"
ifeq ($(OS),Windows_NT)
	@cmd /c "type db_dumps\%DUMP% | docker exec -i %CONTAINER% psql -U postgres"
else
	@cat "db_dumps/$${DUMP}" | docker exec -i $${CONTAINER} psql -U postgres
endif

# Internal target: zip document files from a live DB. Requires DB and FILEZIP to be set.
.PHONY: _export_document_files
_export_document_files:
	@set -e; \
	TMPLIST=$$(mktemp); \
	docker exec $${CONTAINER} psql -qt -U postgres -d $${DB} \
	    -c "SELECT hash FROM document WHERE deleted = false;" | \
	tr -d ' \r' | \
	while IFS= read -r hash; do \
	    [ -z "$$hash" ] && continue; \
	    for f in files/$$hash.*; do \
	        [ -f "$$f" ] && echo "$$f"; \
	    done; \
	done > $$TMPLIST; \
	[ -s "$$TMPLIST" ] && zip -qj "$${FILEZIP}" -@ < $$TMPLIST || true; \
	rm -f $$TMPLIST; \
	echo "Done: $${FILEZIP}"

.PHONY: anonymize_dump
anonymize_dump: backend/node_modules/.uptodate
	@echo "Creating anonymized dump from $${DUMP}"
	@set -e; \
	TS="$$(date +%d-%m-%Y_%H_%M_%S)"; \
	SIDECAR="care_anon_$$(date +%s)"; \
	OUTFILE="db_dumps/anonymized_$$TS.sql"; \
	FILEZIP="db_dumps/anonymized_$${TS}_files.zip"; \
	echo "Sidecar DB: $$SIDECAR"; \
	docker exec $${CONTAINER} psql -q -U postgres -c "CREATE DATABASE $$SIDECAR" > /dev/null; \
	echo "[1/5] Restoring dump into sidecar DB..."; \
	tr -d '\r' < "db_dumps/$${DUMP}" | \
	    awk '/^\\connect care$$/{p=1;next} p && /^\\restrict /{next} p && /^\\unrestrict /{next} p{print}' | \
	    docker exec -i $${CONTAINER} psql -q -U postgres -d $$SIDECAR > /dev/null; \
	echo "[2/5] Migrating schema..."; \
	(cd backend && POSTGRES_CAREDB=$$SIDECAR ADMIN_EMAIL="$(ADMIN_EMAIL)" ADMIN_PWD="$(ADMIN_PWD)" GUEST_EMAIL="$(GUEST_EMAIL)" GUEST_PWD="$(GUEST_PWD)" npm run --silent db_migrate); \
	EXTRA=""; \
	[ -n "$${SEED}" ] && EXTRA="$$EXTRA --seed $${SEED}"; \
	[ -n "$${NUM}" ] && EXTRA="$$EXTRA --num $${NUM}"; \
	echo "[3/5] Anonymizing data..."; \
	(cd backend && POSTGRES_CAREDB=$$SIDECAR npm run anonymize -- $$EXTRA); \
	echo "[4/5] Resetting admin password..."; \
	(cd backend && ADMIN_EMAIL="$(ADMIN_EMAIL)" POSTGRES_CAREDB=$$SIDECAR npm run --silent set-admin-password); \
	echo "[5/6] Exporting anonymized dump..."; \
	docker exec $${CONTAINER} pg_dump -c -C -U postgres $$SIDECAR > $$OUTFILE; \
	sed -i "s/$$SIDECAR/$(POSTGRES_CAREDB)/g" $$OUTFILE; \
	sed -i '/^CREATE DATABASE/i DROP DATABASE IF EXISTS $(POSTGRES_CAREDB);' $$OUTFILE; \
	echo "[6/6] Archiving relevant document files..."; \
	$(MAKE) _export_document_files CONTAINER=$${CONTAINER} DB=$$SIDECAR FILEZIP=$$FILEZIP; \
	docker exec $${CONTAINER} psql -q -U postgres -c "DROP DATABASE $$SIDECAR" > /dev/null; \
	echo "Done: $$OUTFILE and $$FILEZIP"

.PHONY: export_dump_files
export_dump_files:
	@set -e; \
	SIDECAR="care_anon_files_$$(date +%s)"; \
	FILEZIP="db_dumps/$$(basename $${DUMP} .sql)_files.zip"; \
	docker exec $${CONTAINER} psql -q -U postgres -c "CREATE DATABASE $$SIDECAR" > /dev/null; \
	tr -d '\r' < "db_dumps/$${DUMP}" | \
	    awk '/^\\connect /{next} /^\\restrict /{next} /^\\unrestrict /{next} {print}' | \
	    docker exec -i $${CONTAINER} psql -q -U postgres -d $$SIDECAR > /dev/null; \
	$(MAKE) _export_document_files CONTAINER=$${CONTAINER} DB=$$SIDECAR FILEZIP=$$FILEZIP; \
	docker exec $${CONTAINER} psql -q -U postgres -c "DROP DATABASE $$SIDECAR" > /dev/null

.PHONY: admin-password
admin-password: backend/node_modules/.uptodate
	cd backend && ADMIN_EMAIL="$(ADMIN_EMAIL)" npm run set-admin-password

.PHONY: check_clean clean

check_clean:
ifeq ($(OS),Windows_NT)
	@PowerShell -Command "$$response = Read-Host 'Are you sure? This will wipe out the entire database [y/N]'; if ($$response -ne 'y') { exit 1 }"
else
	@echo -n "Are you sure? This will wipe out the entire database [y/N] " && read ans && [ $${ans:-N} = y ]
endif

clean: check_clean
	@echo "Cleaning project code and database. WARNING: This will remove your current DB state."
ifeq ($(OS),Windows_NT)
	@if exist "frontend\node_modules" rmdir /S /Q "frontend\node_modules"
	@if exist "backend\node_modules" rmdir /S /Q "backend\node_modules"
	@if exist "utils\modules\editor-delta-conversion\node_modules" rmdir /S /Q "utils\modules\editor-delta-conversion\node_modules"
	@if exist "utils\modules\assessment-score\node_modules" rmdir /S /Q "utils\modules\assessment-score\node_modules"
	@if exist "dist" rmdir /S /Q "dist"
	@for %%F in (files*) do if "%%~nxF" neq "8852a746-360e-4c31-add2-4d1c75bfb96d.pdf" del "%%F"
else
	rm -rf frontend/node_modules
	rm -rf backend/node_modules
	rm -rf care/utils/modules/editor-delta-conversion/node_modules
	rm -rf care/utils/modules/assessment-score/node_modules
	rm -rf dist
	find files -maxdepth 1 -type f ! -name "8852a746-360e-4c31-add2-4d1c75bfb96d.pdf" -exec rm {} \;
endif
	@docker compose rm -f -s -v
	@docker network rm care_default || echo "IGNORING ERROR"

.PHONY: check_kill
check_kill:
	@echo -n "Are you sure? This will kill node instances running on your system! [y/N] " && read ans && [ $${ans:-N} = y ]

.PHONY: kill
kill: check_kill
	killall node

frontend/node_modules/.uptodate: frontend/package.json frontend/package-lock.json
	cd frontend && npm install --no-audit --no-fund --loglevel=error
ifeq ($(OS),Windows_NT)
	type NUL > $@
else
	@touch $@
endif

backend/node_modules/.uptodate: backend/package.json backend/package-lock.json
	cd backend && npm install --no-audit --no-fund --loglevel=error
ifeq ($(OS),Windows_NT)
	type NUL > $@
else
	@touch $@
endif

utils/modules/%/node_modules/.uptodate: utils/modules/%/package.json
	@echo "Running npm install in $(@D)"
	@cd $(@D) && npm install --no-audit --no-fund --loglevel=error
ifeq ($(OS),Windows_NT)
	@echo. > $@
else
	@touch $@
endif

install-utils-modules:
ifeq ($(OS),Windows_NT)
	@if exist "frontend\node_modules" rmdir /S /Q "frontend\node_modules"
	@for /D %%d in (utils\modules\*) do @if exist "%%d\package.json" (cd %%d && npm install --no-audit --no-fund --loglevel=error && @echo. > node_modules\.uptodate)
else
	rm -rf frontend/node_modules
	@for d in $(shell find utils/modules -type d -maxdepth 1 -mindepth 1); do \
		(cd $$d && npm install --no-audit --no-fund --loglevel=error && touch node_modules/.uptodate); \
	done
endif

.PHONY: modules
modules: install-utils-modules

.PHONY: audit
# All three audits run even if one fails; exit 1 if any failed (npm.cmd avoids PowerShell execution policy on npm.ps1).
ifeq ($(OS),Windows_NT)
audit:
	@powershell -NoProfile -Command "$$e=0; foreach ($$p in @('frontend','backend','utils/modules/editor-delta-conversion','utils/modules/assessment-score')) { Write-Host ''; Write-Host ('=== npm audit: ' + $$p + ' ==='); npm.cmd audit --prefix (Join-Path '$(CURDIR)' $$p); if ($$LASTEXITCODE -ne 0) { $$e=1 } }; exit $$e"
else
audit:
	@st=0; for d in frontend backend utils/modules/editor-delta-conversion utils/modules/assessment-score; do \
		echo ""; echo "=== npm audit: $$d ==="; \
		npm audit --prefix $$d || st=1; \
	done; exit $$st
endif