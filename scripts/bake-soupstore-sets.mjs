#!/usr/bin/env node
/**
 * Bakes the Soup Store Season 4 preset bundles from Smogon Dex sets (see `fetch-smogon-dex-sets.mjs`).
 *
 * Usage:
 *   node scripts/bake-soupstore-sets.mjs --bss champions-bss.json --natdex natdex.json --bans bans.json
 *
 * Sources, in priority order (a species covered by an earlier one is skipped in later ones):
 *   1. Smogon Dex, Champions Battle Stadium Singles: converted from Stat Points/Level 50 to EVs/Level 100
 *   2. Smogon Dex, Gen 9 National Dex Singles: already EVs/Level 100
 * `bans.json` (optional) is `{ species, ... }` with banned species IDs as `{ id: 1 }`, i.e., `metagameBans.soupstoreseason4` from
 * `BattleTeambuilderTable.natdexchampions` in the Soup Store client. Sets of banned species are skipped. Banned abilities, items,
 * moves & combinations are kept in the sets on purpose: the extension marks them as banned so they can be swapped.
 *
 * Writes `src/assets/bundles/<id>.json` & registers both in `buns.json` under `format: 'soupstoreseason4'`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SoupStoreBundles, buildBundlePayload, convertChampionsSet, toId } from './lib/soupstoreSets.mjs';

const bundlesDir = fileURLToPath(new URL('../src/assets/bundles/', import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const { values } = parseArgs({
  options: {
    bss: { type: 'string' },
    natdex: { type: 'string' },
    bans: { type: 'string' },
  },
});

if (!values.bss && !values.natdex) {
  console.error('usage: bake-soupstore-sets.mjs --bss <file> --natdex <file> [--bans <file>]');
  process.exit(1);
}

const bans = values.bans ? readJson(values.bans) : {};
const buns = readJson(`${bundlesDir}buns.json`);
const now = new Date().toISOString();
const covered = new Set();

const bake = (key, sets, convert) => {
  const payload = buildBundlePayload(sets, { convert, bans, exclude: covered });
  const bundle = SoupStoreBundles[key];

  Object.keys(payload).forEach((species) => covered.add(toId(species)));

  writeFileSync(`${bundlesDir}${bundle.id}.json`, `${JSON.stringify({ ok: true, status: 'list', ntt: 'presets', payload })}\n`);

  buns.payload.presets[bundle.id] = {
    id: bundle.id,
    ntt: 'presets',
    name: bundle.name,
    label: bundle.label,
    author: 'Smogon',
    ext: null,
    gen: 9,
    format: 'soupstoreseason4',
    desc: bundle.desc,
    created: buns.payload.presets[bundle.id]?.created || now,
    updated: now,
    disabled: false,
  };

  console.log(`${bundle.name}: ${Object.keys(payload).length} species`);
};

// priority order: BSS first, so its species are excluded from the National Dex bundle
if (values.bss) {
  bake('bss', readJson(values.bss), convertChampionsSet);
}

if (values.natdex) {
  bake('natdex', readJson(values.natdex));
}

writeFileSync(`${bundlesDir}buns.json`, `${JSON.stringify(buns, null, 2)}\n`);
