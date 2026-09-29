#!/usr/bin/env node
/**
 * Downloads strategy sets from the Smogon Dex into a normalized JSON file for `bake-soupstore-sets.mjs`.
 *
 * Usage:
 *   node scripts/fetch-smogon-dex-sets.mjs --gen champions --species species.txt --out champions.json
 *   node scripts/fetch-smogon-dex-sets.mjs --gen sv --species species.txt --out sv.json
 *
 * * `--gen` is the Smogon Dex gen slug (`champions`, `sv`).
 * * `--species` is a text file with one species name per line (e.g., the Pokemon the Soup Store client's teambuilder table lists).
 * * Each page is downloaded once & the sets of *every* format on it are kept, so the output is
 *   `{ [format name]: { [species]: { [set name]: set } } }`. Pass `--format` (repeatable) to keep only some formats.
 *   The format names are the ones shown on the Dex (e.g., `Battle Stadium Singles`, `National Dex`, `National Dex Ubers`, `OU`).
 * * Needs network access to smogon.com. Requests are spaced out to be polite.
 * * Behind an HTTP proxy, run with `NODE_USE_ENV_PROXY=1` (Node 22.21+), since `fetch` ignores `HTTPS_PROXY` otherwise.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { extractMovesetsByFormat } from './lib/smogonDex.mjs';

const { values } = parseArgs({
  options: {
    gen: { type: 'string' },
    format: { type: 'string', multiple: true },
    species: { type: 'string' },
    out: { type: 'string' },
    delay: { type: 'string', default: '400' },
  },
});

if (!values.gen || !values.species || !values.out) {
  console.error('usage: fetch-smogon-dex-sets.mjs --gen <slug> --species <file> --out <file> [--format <name> ...]');
  process.exit(1);
}

const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const species = readFileSync(values.species, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
const wanted = values.format?.map((f) => f.toLowerCase());
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const output = {};
let missing = 0;

for (const name of species) {
  const url = `https://www.smogon.com/dex/${values.gen}/pokemon/${slugify(name)}/`;
  const response = await fetch(url, { headers: { 'User-Agent': 'soupstore-showdex-bake' } });

  if (!response.ok) {
    console.warn(`skipped ${name}: ${response.status}`);
    missing++;
  } else {
    for (const [format, sets] of Object.entries(extractMovesetsByFormat(await response.text()))) {
      if (!wanted || wanted.includes(format.toLowerCase())) {
        for (const [speciesForme, named] of Object.entries(sets)) {
          Object.assign((output[format] ||= {})[speciesForme] ||= {}, named);
        }
      }
    }
  }

  await sleep(Number(values.delay));
}

writeFileSync(values.out, `${JSON.stringify(output, null, 2)}\n`);
console.log(`wrote ${Object.keys(output).length} formats (${missing} pages skipped) to ${values.out}:`);

for (const [format, sets] of Object.entries(output).sort((a, b) => Object.keys(b[1]).length - Object.keys(a[1]).length)) {
  console.log(`  ${format}: ${Object.keys(sets).length} species`);
}
