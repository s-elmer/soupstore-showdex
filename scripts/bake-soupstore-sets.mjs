#!/usr/bin/env node
/**
 * Bakes the Soup Store Season 4 preset bundles from Smogon Dex sets (see `fetch-smogon-dex-sets.mjs`).
 *
 * Usage:
 *   node scripts/bake-soupstore-sets.mjs --champions champions.json --sv sv.json --bans bans.json
 *
 * Sources, most preferred first (see `SetSourcePriority` in `lib/soupstoreSets.mjs`). A Pokemon gets the sets of the
 * first source that has any for it, & nothing from the later ones:
 *   1. Champions Battle Stadium Singles (converted from Stat Points/Level 50 to EVs/Level 100)
 *   2. Gen 9 National Dex, then National Dex Ubers, UU & RU (already EVs/Level 100)
 *   3. Gen 9 tiers: OU, Ubers, UU, RU, NU, PU & ZU
 * `--champions` & `--sv` are the outputs of `fetch-smogon-dex-sets.mjs` for the `champions` & `sv` Dex gens.
 *
 * `bans.json` (optional) is `{ species, ... }` with banned species IDs as `{ id: 1 }`, i.e., `metagameBans.soupstoreseason4` from
 * `BattleTeambuilderTable.natdexchampions` in the Soup Store client. Sets of banned species are skipped. Banned abilities, items,
 * moves & combinations are kept in the sets on purpose: the extension marks them as banned so they can be swapped.
 *
 * Writes `src/assets/bundles/<id>.json` & registers them in `buns.json` under `format: 'soupstoreseason4'`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SoupStoreBundles, buildAllBundles } from './lib/soupstoreSets.mjs';

const bundlesDir = fileURLToPath(new URL('../src/assets/bundles/', import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const { values } = parseArgs({
  options: {
    champions: { type: 'string' },
    sv: { type: 'string' },
    bans: { type: 'string' },
  },
});

if (!values.champions || !values.sv) {
  console.error('usage: bake-soupstore-sets.mjs --champions <file> --sv <file> [--bans <file>]');
  process.exit(1);
}

const bans = values.bans ? readJson(values.bans) : {};
const buns = readJson(`${bundlesDir}buns.json`);
const now = new Date().toISOString();

const { payloads, report } = buildAllBundles({ champions: readJson(values.champions), sv: readJson(values.sv) }, { bans });

for (const { format, species, missing } of report) {
  console.log(`${format}: ${missing ? 'NOT FOUND in the download (check the format name)' : `${species.length} new species`}`);
}

for (const [key, payload] of Object.entries(payloads)) {
  const bundle = SoupStoreBundles[key];

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
}

writeFileSync(`${bundlesDir}buns.json`, `${JSON.stringify(buns, null, 2)}\n`);
