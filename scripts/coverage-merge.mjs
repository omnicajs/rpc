import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';

const {createCoverageMap} = libCoverage;
const {createContext} = libReport;

const {outDir, inputFiles} = parseArgs(process.argv.slice(2));

if (inputFiles.length === 0) {
  throw new Error('At least one coverage-final.json file is required.');
}

const coverageMap = createCoverageMap({});

for (const inputFile of inputFiles) {
  const resolvedInput = path.resolve(inputFile);

  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`Coverage file does not exist: ${inputFile}`);
  }

  coverageMap.merge(JSON.parse(fs.readFileSync(resolvedInput, 'utf8')));
}

fs.mkdirSync(outDir, {recursive: true});
fs.writeFileSync(
  path.join(outDir, 'coverage-final.json'),
  `${JSON.stringify(coverageMap.toJSON())}\n`,
);

const context = createContext({
  dir: outDir,
  coverageMap,
});

for (const reporter of ['json-summary', 'lcovonly', 'text']) {
  reports.create(reporter).execute(context);
}

function parseArgs(args) {
  const inputFiles = [];
  let outDir = 'coverage-merged';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--out') {
      const next = args[index + 1];

      if (next == null) {
        throw new Error('--out requires a directory path.');
      }

      outDir = next;
      index += 1;
      continue;
    }

    inputFiles.push(arg);
  }

  return {
    outDir: path.resolve(outDir),
    inputFiles,
  };
}
