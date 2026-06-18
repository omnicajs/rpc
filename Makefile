.DEFAULT_GOAL := help

COMPOSE ?= docker compose
YARN=$(COMPOSE) run --rm node yarn

CC_BLUE := $(shell tput -Txterm setaf 4 2>/dev/null)
CC_GREEN := $(shell tput -Txterm setaf 2 2>/dev/null)
CC_CYAN := $(shell tput -Txterm setaf 6 2>/dev/null)
CC_END := $(shell tput -Txterm sgr0 2>/dev/null)

TARGET_HEADER=@printf '===== $(CC_BLUE)%s$(CC_END)\n' $@
TARGET_OK=@printf '$(CC_GREEN)OK$(CC_END)\n'

.PHONY: help
help: ## [General] Shows command help
	@awk -v c_tgt="$(CC_CYAN)" -v c_rst="$(CC_END)" 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  %s%-20s%s %s\n", c_tgt, $$1, c_rst, $$2}' $(MAKEFILE_LIST)

.PHONY: compose-check
compose-check: ## [Setup] Checks Docker Compose files
	$(TARGET_HEADER)
	node scripts/compose-check.mjs compose.yml
	$(COMPOSE) --profile '*' config >/dev/null
	$(TARGET_OK)

node_modules: compose-check package.json yarn.lock ## [Setup] Installs dependencies
	$(TARGET_HEADER)
	@$(YARN) install --silent
	@touch node_modules || true
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

.PHONY: tests-e2e
tests-e2e: node_modules ## [Tests] Runs browser e2e tests
	$(TARGET_HEADER)
ifdef cli
	$(COMPOSE) --profile e2e run --rm e2e-vitest yarn test:e2e $(cli)
else
	$(COMPOSE) --profile e2e run --rm e2e-vitest yarn test:e2e
endif
	$(TARGET_OK)

.PHONY: tests-e2e-coverage
tests-e2e-coverage: node_modules ## [Tests] Runs browser e2e tests with coverage
	$(TARGET_HEADER)
ifdef cli
	$(COMPOSE) --profile e2e run --rm e2e-vitest yarn test:e2e:coverage $(cli)
else
	$(COMPOSE) --profile e2e run --rm e2e-vitest yarn test:e2e:coverage
endif
	$(TARGET_OK)

.PHONY: tests-all-coverage
tests-all-coverage: node_modules ## [Tests] Runs unit/integration and e2e coverage, then merges reports
	$(TARGET_HEADER)
	$(YARN) test:coverage
	$(COMPOSE) --profile e2e run --rm e2e-vitest yarn test:e2e:coverage
	$(YARN) coverage:merge
	$(TARGET_OK)

.PHONY: typecheck
typecheck: node_modules ## [Tests] Checks TypeScript types
	$(TARGET_HEADER)
	$(YARN) typecheck
	$(TARGET_OK)

.PHONY: actionlint
actionlint: ## Lints GitHub Actions workflows
	docker run --rm -v "$$(pwd):/repo" -w /repo rhysd/actionlint:latest
