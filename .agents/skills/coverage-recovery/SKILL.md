---
name: coverage-recovery
description: Use this skill when coverage in the @omnicajs/rpc package is low or when uncovered paths need analysis and resolution without synthetic tests.
---

# Coverage Recovery

## When To Use
Use this skill when user asks to:
- raise coverage;
- analyze uncovered files/lines/branches;
- explain why some paths remain uncovered.

## Source Of Truth
- `vitest.config.ts`
- `package.json` (`test:coverage:*`)
- `Makefile` for available local verification targets
- `coverage/coverage-final.json`, `coverage/coverage-summary.json`, and `coverage/lcov.info` after a coverage run

## Principles
- Coverage is a quality signal, not a vanity target.
- Prioritize real public behavior scenarios.
- Do not add artificial tests only to bump numbers.
- Prefer removing dead code or simplifying branches over testing impossible paths.
- Keep tests focused on RPC behavior, adaptors, encoding, memory management, and exported helpers.
- Use existing test helpers and aliases: `@/*` for `src/*`, `~tests/*` for `tests/*`.

## Workflow
1. Collect fresh data:
```bash
corepack yarn test:coverage
```
2. Inspect reports:
- terminal coverage summary;
- `coverage/index.html`;
- `coverage/lcov.info`;
- `coverage/coverage-final.json`;
- `coverage/coverage-summary.json`.
3. Classify uncovered paths:
- real scenario gap;
- defensive/error branch;
- dead/redundant logic;
- architecture smell (too coupled/hard to trigger naturally).
4. Resolve in order:
- add/adjust tests for real scenarios;
- add controlled error-path tests;
- remove/simplify dead branches;
- propose refactor when testability is architecture-limited.
5. Re-run checks:
```bash
corepack yarn typecheck
corepack yarn vitest run
corepack yarn test:coverage
corepack yarn build
corepack yarn lint
```

## Controlled Failure Examples
- malformed endpoint messages;
- unknown call IDs and late result messages;
- missing exposed RPC methods;
- encode/decode failures and released function proxies;
- MessagePort polyfill queueing/listener edge cases;
- iframe and worker adaptor listener/origin/termination paths.

## Stop Condition
If progress stalls:
1. stop brute-force additions;
2. list exact uncovered spots and reason;
3. offer options:
- keep as defensive uncovered path;
- refactor for testability;
- remove unreachable branch.
