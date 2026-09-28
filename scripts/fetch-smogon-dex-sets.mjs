#!/usr/bin/env node
/**
 * Downloads strategy sets from the Smogon Dex into a normalized JSON file for `bake-soupstore-sets.mjs`.
 *
 * Usage:
 *   node scripts/fetch-smogon-dex-sets.mjs --gen champions --format BSS --species species.txt --out champions-bss.json
 *   node scripts/fetch-smogon-dex-sets.mjs --gen sv --format "National Dex" --species species.txt --out natdex.json
 *
 * * `--gen` is the Smogon Dex gen slug (`champions`, `sv`), `--format` is the strategy format name shown on the Dex page
 *   (Champions Battle Stadium Singles is `BSS`, Gen 9 National Dex is `National Dex`; adjust if Smogon renames them).
 * * `--species` is a text file with one species name per line (e.g., the Pokemon the Soup Store client's teambuilder table lists).
 * * Needs network access to smogon.com. Requests are spaced out to be polite.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { extractMovesets } from './lib/smogonDex.mjs';

const { values } = parseArgs({
  options: {
    gen: { type: 'string' },
    format: { type: 'string' },
    species: { type: 'string' },
    out: { type: 'string' },
    delay: { type: 'string', default: '400' },
  },
});

if (!values.gen || !values.format || !values.species || !values.out) {
  console.error('usage: fetch-smogon-dex-sets.mjs --gen <slug> --format <name> --species <file> --out <file>');
  process.exit(1);
}

const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const species = readFileSync(values.species, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
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
    Object.assign(output, extractMovesets(await response.text(), values.format));
  }

  await sleep(Number(values.delay));
}

writeFileSync(values.out, `${JSON.stringify(output, null, 2)}\n`);
console.log(`wrote ${Object.keys(output).length} species (${missing} pages skipped) to ${values.out}`);
