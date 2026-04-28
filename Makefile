# OmegaX Protocol — single-command bootstrap and gate runners.
# Wraps the canonical npm scripts so contributors don't have to read four
# READMEs to set up a working tree.
# All targets are .PHONY because they don't produce filesystem outputs the
# default Make rules would care about.

.PHONY: help dev verify test build lint fmt-check doctor clean

help:
	@echo "OmegaX Protocol — common commands"
	@echo ""
	@echo "  make dev      Install root + frontend deps and run the doctor"
	@echo "  make verify   Run the full public verification gate"
	@echo "                (npm run verify:public — rust + node + frontend + readiness + hygiene + license)"
	@echo "  make test     Run the fast Node test suite (npm run test:node)"
	@echo "  make build    Build the frontend (npm run frontend:build)"
	@echo "  make lint     Run cargo clippy (npm run rust:lint)"
	@echo "  make fmt-check Run cargo fmt --check (npm run rust:fmt:check)"
	@echo "  make doctor   Run the repo doctor (npm run doctor)"
	@echo ""
	@echo "Heavier sign-off (release candidates only):"
	@echo "  npm run test:e2e:localnet"
	@echo "  npm run devnet:operator:drawer:sim"

dev:
	npm ci
	npm --prefix frontend ci
	npm run doctor

verify:
	npm run verify:public

test:
	npm run test:node

build:
	npm run frontend:build

lint:
	npm run rust:lint

fmt-check:
	npm run rust:fmt:check

doctor:
	npm run doctor
