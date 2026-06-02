.PHONY: actionlint
actionlint: ## Lints GitHub Actions workflows
	docker run --rm -v "$$(pwd):/repo" -w /repo rhysd/actionlint:latest
