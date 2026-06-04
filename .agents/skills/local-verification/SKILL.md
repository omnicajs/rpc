---
name: local-verification
description: Use this skill when validating changes in this repository before commit, push, or review. It maps the local package checks to Makefile and Yarn commands, runs focused checks first, and reports exact failing phases.
---

# Local Verification

## When To Use
Use this skill when:
- the user asks to check the project locally;
- validating a fix before commit or push;
- isolating a failing build, typecheck, or test run;
- confirming package artifacts and declarations are generated.

## Command Map
Default full verification:
```bash
make typecheck
make tests
make build
```

Focused commands:
```bash
make tests cli='tests/unit/errors.spec.ts'
yarn tsc --noEmit -p tests/tsconfig.json
yarn build
```

## Workflow
1. If the user asks for a full check, run the full verification commands in order.
2. If investigating a specific failure, start with the smallest relevant command.
3. Stop at the first failing command unless the user asks to continue.
4. Report:
   - phase name;
   - exact command;
   - key error lines;
   - minimal fix;
   - recheck command.
5. After fixing, rerun the failed command, then run dependent confidence checks.

## Notes
- `dist/` is generated output and ignored by git.
- `make build` runs Vite and `unplugin-dts`, producing JS and `.d.ts` files in `dist/`.
- `make typecheck` checks both `src/` and `tests/` via `tsconfig.typecheck.json`.
- `tests/tsconfig.json` exists for IDE and direct test-project type checking.
