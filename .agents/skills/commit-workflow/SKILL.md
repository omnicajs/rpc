---
name: commit-workflow
description: Use this skill when creating commits in this repository. It standardizes change grouping, Conventional Commit type selection, English commit subjects, validation commands, and safe git operation order.
---

# Commit Workflow

## When To Use
Use this skill when the user asks to:
- create one or more commits;
- split pending changes into commits;
- choose a commit message;
- validate the repository before committing.

## Required Rules
- Use Conventional Commits.
- Commit message language: English.
- Allowed types: `feat`, `fix`, `build`, `ci`, `perf`, `docs`, `refactor`, `style`, `test`, `chore`.
- Keep type and optional scope lowercase English.
- Phrase the subject as a short completed fact, not an instruction.
- Make the subject changelog-friendly: it should read like a historical fact about what changed for the project, not like a task, implementation note, or local action.
- Do not end the subject with a period.
- Do not rewrite existing history unless explicitly requested.
- Run git index/ref mutating commands sequentially, never in parallel.

## Type Selection
- `build`: package output, Vite, TypeScript, dependency, lockfile, or Makefile build/test command changes.
- `test`: test files or test-only infrastructure.
- `docs`: README or documentation-only changes.
- `chore`: repository housekeeping, ignore files, local tooling with no build contract change.
- `refactor`: internal code structure changes under the same public behavior.
- `fix`: broken existing behavior corrected.
- `feat`: new supported public behavior or API capability.

## Workflow
1. Inspect pending changes:
```bash
git status --short
git diff
```
2. Group changes by logical intent. Prefer one commit when the changes are one coherent repository setup step.
3. Validate relevant commands before committing:
```bash
make typecheck
make tests
make build
```
4. Stage only the intended files:
```bash
git add <files>
```
5. Commit non-interactively:
```bash
git commit -m "<type>(<scope>): <English summary>"
```
6. Verify:
```bash
git status --short
git log -1 --oneline --decorate
```

## Message Examples
- `build: Configure package build and validation`
- `test: Move tests to the root directory`
- `chore: Add local agent instructions`

## Changelog-Friendly Subject Examples
- Good: `ci: Release workflow can skip changelog generation`
- Good: `test: Tests run from the root directory`
- Avoid: `ci: Add skip_changelog input`
- Avoid: `test: Move files around`
