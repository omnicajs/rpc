import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const options = parseArgs(process.argv.slice(2));
const current = readCoverageSummary(options.current).total;
const base = options.base && fs.existsSync(options.base)
  ? readCoverageSummary(options.base).total
  : undefined;
const metrics = ['lines', 'statements', 'functions', 'branches'];

const rows = metrics.map((metric) => {
  const currentPct = current[metric].pct;
  const basePct = base?.[metric]?.pct;
  const delta = basePct === undefined ? undefined : currentPct - basePct;

  return `| ${metric} | ${formatPct(currentPct)} | ${formatDelta(delta)} |`;
});

fs.appendFileSync(
  options.out,
  [
    `## ${options.title}`,
    '',
    '| Metric | Current | Delta |',
    '| --- | ---: | ---: |',
    ...rows,
    '',
    base
      ? `Delta is calculated against the ${options.baseLabel}.`
      : `${capitalize(options.baseLabel)} was not available, so delta is not shown.`,
    '',
  ].join('\n'),
);

function readCoverageSummary(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function formatPct(value) {
  return `${value.toFixed(2)}%`;
}

function formatDelta(value) {
  if (value === undefined) {
    return 'n/a';
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)} pp`;
}

function capitalize(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function parseArgs(args) {
  const options = {
    current: undefined,
    base: undefined,
    out: process.env.GITHUB_STEP_SUMMARY,
    title: 'Coverage',
    baseLabel: 'base branch coverage artifact',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    const value = args[index + 1];

    if (value == null || value.startsWith('--')) {
      throw new Error(`${arg} requires a value.`);
    }

    if (!(key in options)) {
      throw new Error(`Unknown option: ${arg}`);
    }

    options[key] = value;
    index += 1;
  }

  if (options.current == null) {
    throw new Error('--current is required.');
  }

  if (options.out == null) {
    throw new Error('--out is required when GITHUB_STEP_SUMMARY is not set.');
  }

  return options;
}
