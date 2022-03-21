.PHONY: default
default: help

.PHONY: help
help:
	@echo "make help              Show this help message"
	@echo "make dev               Run the app in the development server"
	@echo "make all               Build everything"
	@echo "make pdfjs             Build Framework PDFjs"
	@echo "make h_server          Build Framework Hypothesis Server"
	@echo "make h_client          Build Framework Hypothesis Client"
	@echo "make build             Create a production build of the client"
	@echo "make clean             Delete development files"

.PHONY: dev
dev: node_modules/.uptodate
ifeq (,$(wildcard frameworks/pdf.js/build/generic/build/pdf.js))
	@echo "Building pdfjs..."
	make pdfjs
endif
ifeq (,$(wildcard frameworks/hypothesis/client/build/manifest.js))
	@echo "Building h_client..."
	make h_client
endif
ifeq (,$(wildcard frameworks/hypothesis/h/build/manifest.json))
	@echo "Building h_server..."
	make h_server
endif
	node_modules/.bin/gulp build

.PHONY: all
all: node_modules/.uptodate
	make pdfjs
	make h_client
	make h_server
	node_modules/.bin/gulp build

.PHONY: clean
clean:
	rm -f node_modules/.uptodate
	rm -rf build

.PHONY: build
build: node_modules/.uptodate
	yarn run build

node_modules/.uptodate: package.json yarn.lock
	yarn install
	@touch $@

pdfjs: frameworks/pdf.js/package.json
	cd frameworks/pdf.js &&	npm install gulp-cli
	cd frameworks/pdf.js && npm install
	cd frameworks/pdf.js && node_modules/.bin/gulp generic

h_server: frameworks/hypothesis/h/package.json
	cd frameworks/hypothesis/h && make services
	cd frameworks/hypothesis/h && make dev

h_client: frameworks/hypothesis/client/package.json
	cd frameworks/hypothesis/client && make build