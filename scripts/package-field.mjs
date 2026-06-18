import fs from 'node:fs';
import process from 'node:process';

const [field] = process.argv.slice(2);

if (field == null) {
  throw new Error('Package field name is required.');
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const value = packageJson[field];

if (value == null) {
  throw new Error(`Package field does not exist: ${field}`);
}

if (typeof value !== 'string') {
  throw new Error(`Package field is not a string: ${field}`);
}

process.stdout.write(value);
