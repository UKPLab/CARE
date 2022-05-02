#!make
include .env
export

.PHONY: default
default: help

.PHONY: help
help:
	@echo "make help              Show this help message"
	@echo "make dev               Run the app in the development server"
	@echo "make pdfjs             Build Framework PDFjs"
	@echo "make h_server          Build Framework Hypothesis Server"
	@echo "make h_client          Build Framework Hypothesis Client"
	@echo "make build             Create a production build of the client"
	@echo "make clean             Delete development files"
	@echo "make docker			  Generate docker images"
	@echo "make init              Auto-Config h server"

.PHONY: dev
dev: node_modules/.uptodate
ifeq (,$(wildcard frameworks/pdf.js/build/generic/build/pdf.js))
	@echo "Building pdfjs..."
	make pdfjs
endif
ifeq (,$(wildcard frameworks/hypothesis/client/build/manifest.json))
	@echo "Building h_client..."
	make h_client
endif
	npm run frontend-dev-build
	npm run backend-dev

.PHONY: clean
clean:
	rm -f node_modules/.uptodate
	rm -rf dist
	cd frameworks/hypothesis/client && make clean
	docker image prune -a

.PHONY: build
build:
	docker-compose -f docker-compose.yml up

node_modules/.uptodate: package.json package-lock.json
	npm install
	@touch $@

.PHONY: pdfjs
pdfjs: frameworks/pdf.js/package.json
	cd frameworks/pdf.js && npm install
	cd frameworks/pdf.js && node_modules/.bin/gulp generic

.PHONY: h_server
h_server: frameworks/hypothesis/h/package.json
	cd frameworks/hypothesis/h && make services
	cd frameworks/hypothesis/h && make dev

.PHONY: h_client
h_client: frameworks/hypothesis/client/package.json
	cd frameworks/hypothesis/client && make build

.PHONY: services
services:
	cd frameworks/hypothesis/h && make services


.PHONY: init
init:
	cd frameworks/hypothesis/h && tox -qe dev -- sh bin/hypothesis --dev init
	npm run init-db
	cd frameworks/hypothesis/h && tox -qe dev -- sh bin/hypothesis --dev user password ${H_SERVER_ADMIN_USER} --password ${H_SERVER_ADMIN_PASSWORD}



