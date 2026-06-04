---
name: yarn-lock-conflict-resolution
description: Use this skill when resolving merge or rebase conflicts in yarn.lock for this Yarn v1 package. It standardizes choosing a lockfile baseline, reconciling it with yarn install, and avoiding manual marker edits.
---

# Yarn.lock Conflict Resolution

## When To Use
Use this skill when:
- `yarn.lock` has merge or rebase conflict markers;
- dependency changes need to be replayed after a rebase;
- the same lockfile conflict repeats during a rebase sequence.

## Source Of Truth Policy
- Rebase: start from the lockfile in the branch being rebased onto.
- Merge: start from `HEAD` unless the user explicitly wants the other side.
- After replacing the lockfile baseline, run `yarn install` to reconcile it with `package.json`.

## Required Rules
- Do not manually edit conflict markers inside `yarn.lock`.
- Replace `yarn.lock` completely from the selected baseline.
- Run git commands that mutate index or refs sequentially.
- If dependency updates were intentional in the current branch, replay the original `yarn add`, `yarn remove`, or `yarn install` step after baseline replacement.

## Workflow
1. Confirm conflict state:
```bash
git status --short
```
2. For rebase, take the target branch lockfile:
```bash
ONTO=$(cat .git/rebase-merge/onto 2>/dev/null || cat .git/rebase-apply/onto)
git show "$ONTO:yarn.lock" > yarn.lock
yarn install
git add yarn.lock
```
3. For merge, take current branch lockfile:
```bash
git show "HEAD:yarn.lock" > yarn.lock
yarn install
git add yarn.lock
```
4. Continue the operation:
```bash
git rebase --continue
# or
git merge --continue
```

## Validation
- `git status --short` shows no unresolved `yarn.lock`.
- `yarn.lock` is staged before continuing.
- Run relevant checks after conflict resolution:
```bash
make typecheck
make tests
make build
```
