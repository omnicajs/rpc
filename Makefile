.DEFAULT_GOAL := help

YARN=corepack yarn

CC_BLUE := $(shell tput -Txterm setaf 4 2>/dev/null)
CC_GREEN := $(shell tput -Txterm setaf 2 2>/dev/null)
CC_CYAN := $(shell tput -Txterm setaf 6 2>/dev/null)
CC_END := $(shell tput -Txterm sgr0 2>/dev/null)

TARGET_HEADER=@printf '===== $(CC_BLUE)%s$(CC_END)\n' $@
TARGET_OK=@printf '$(CC_GREEN)OK$(CC_END)\n'

.PHONY: help
help: ## [General] Shows command help
	@awk -v c_tgt="$(CC_CYAN)" -v c_rst="$(CC_END)" 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  %s%-20s%s %s\n", c_tgt, $$1, c_rst, $$2}' $(MAKEFILE_LIST)

node_modules: package.json yarn.lock ## [Setup] Installs dependencies
	$(TARGET_HEADER)
	@$(YARN) install --silent
	$(TARGET_OK)

.PHONY: build
build: node_modules ## [Build] Builds package
	$(TARGET_HEADER)
	$(YARN) build
	$(TARGET_OK)

.PHONY: tests
tests: node_modules ## [Tests] Runs autotests
	$(TARGET_HEADER)
ifdef cli
	$(YARN) test $(cli)
else
	$(YARN) test
endif
	$(TARGET_OK)

.PHONY: typecheck
typecheck: node_modules ## [Tests] Checks TypeScript types
	$(TARGET_HEADER)
	$(YARN) typecheck
	$(TARGET_OK)

.PHONY: actionlint
actionlint: ## Lints GitHub Actions workflows
	docker run --rm -v "$$(pwd):/repo" -w /repo rhysd/actionlint:latest
