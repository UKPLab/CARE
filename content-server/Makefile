.PHONY: default
default: help

.PHONY: help
help:
	@echo "make help              Show this help message"
	@echo "make dev               Run the app in the development server"
	@echo "make build             Create a production build of the client"
	@echo "make clean             Delete development files"

.PHONY: dev
dev: node_modules/.uptodate
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

