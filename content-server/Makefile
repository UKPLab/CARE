
export CLIENT_OAUTH_ID=a2556958-a9cc-11ec-a061-17298d8dd357
export CLIENT_OAUTH_REDIRECT_URL=http://localhost:5000/app.html
export GIT_ACCESS_TOKEN=glpat-nyWsHEGiURVW2yft7inS
export CLIENT_URL=http://localhost:3001/hypothesis
#export WEBSOCKET_URL=ws://localhost:5001/ws
export H_SERVER_ADMIN_USER=admin
export H_SERVER_ADMIN_MAIL=admin@admin.de
export H_SERVER_ADMIN_PASSWORD=test

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
dev: node_modules/.uptodate check_pyenv
ifeq (,$(wildcard frameworks/pdf.js/build/generic/build/pdf.js))
	@echo "Building pdfjs..."
	make pdfjs
endif
ifeq (,$(wildcard frameworks/hypothesis/client/build/manifest.json))
	@echo "Building h_client..."
	make h_client
endif
ifeq (,$(wildcard frameworks/hypothesis/h/build/manifest.json))
	@echo "Building h_server..."
	make h_server
endif
	node_modules/.bin/gulp build

.PHONY: clean
clean:
	rm -f node_modules/.uptodate
	rm -rf build
	cd frameworks/hypothesis/client && make clean
	docker image prune -a

.PHONY: build
build:
	docker-compose -f docker-compose.yml -f frameworks/hypothesis/h/docker-compose.yml up

node_modules/.uptodate: package.json yarn.lock
	yarn install
	@touch $@

pdfjs: frameworks/pdf.js/package.json
	cd frameworks/pdf.js &&	npm install -g gulp-cli
	cd frameworks/pdf.js && npm install
	cd frameworks/pdf.js && node_modules/.bin/gulp generic

h_server: frameworks/hypothesis/h/package.json
	cd frameworks/hypothesis/h && make services
	cd frameworks/hypothesis/h && make dev

h_server_docker:
	docker-compose -f frameworks/hypothesis/h/docker-compose.yml up

h_client: frameworks/hypothesis/client/package.json
	cd frameworks/hypothesis/client && make build

.PHONY: init
init:
	cd frameworks/hypothesis/h && make services
	cd frameworks/hypothesis/h && tox -qe dev -- sh bin/hypothesis --dev init
	node_modules/.bin/gulp init
	cd frameworks/hypothesis/h && tox -qe dev -- sh bin/hypothesis --dev user password ${H_SERVER_ADMIN_USER} --password ${H_SERVER_ADMIN_PASSWORD}

check_pyenv:
ifeq (,$(shell command -v pyenv 2> /dev/null))
	@echo "PyEnv not exists, set it up..."
	sh pyenv.sh
endif



