/**
 * Pure helpers for baking Soup Store preset bundles from Smogon Dex sets.
 *
 * Sets come in the pkmn Sets shape, `{ [species]: { [setName]: { level, evs, ivs, nature, ability, item, moves } } }`
 * (`ability`, `item`, `nature`, `evs` & each entry of `moves` may be arrays of alternatives), which is also the shape
 * of Showdex's bundled preset files.
 *
 * Soup Store Season 4 uses Champions mechanics with mainline stats (Level 100, EVs up to 510, IVs, no Tera), so
 * Champions sets (Stat Points, Level 50) must be converted first (see `convertChampionsSet()`).
 */

export const STAT_IDS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const MAX_STAT_POINTS = 32;
export const EV_LIMIT = 510;

export const toId = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Champions stat points -> EVs. First point is worth 4 EVs & each one after 8, so stats match exactly at Level 50. */
export const statPointsToEvs = (points) => (points > 0 ? Math.min(points * 8 - 4, 252) : 0);

const asArray = (v) => (Array.isArray(v) ? v : [v]);

const convertSpread = (spread) => {
  const evs = Object.fromEntries(STAT_IDS.map((s) => [s, statPointsToEvs(spread?.[s] || 0)]));
  let total = STAT_IDS.reduce((sum, s) => sum + evs[s], 0);

  // same rule as the Soup Store client's "Import from Champions": spreads over 510 EVs (e.g., 32/32/2 is 252/252/12)
  // lose the excess from their smallest invested stat, rounded down to a multiple of 4
  while (total > EV_LIMIT) {
    const smallest = STAT_IDS.filter((s) => evs[s] > 0).sort((a, b) => evs[a] - evs[b])[0];
    const before = evs[smallest];

    evs[smallest] = Math.max(0, Math.floor((before - (total - EV_LIMIT)) / 4) * 4);
    total -= before - evs[smallest];
  }

  return evs;
};

/** Converts a Champions set (Stat Points, Level 50) into a Soup Store one (EVs, Level 100, default IVs, no Tera). */
export const convertChampionsSet = (set) => {
  const { level: _level, ivs: _ivs, teraTypes: _teraTypes, teratypes: _teratypes, ...rest } = set || {};

  return {
    ...rest,
    level: 100,
    ...(set?.evs && {
      evs: Array.isArray(set.evs) ? set.evs.map(convertSpread) : convertSpread(set.evs),
    }),
  };
};

/**
 * Filters the options of a set field by a ban list (`ids`), keeping the original shape (single value or array).
 * Returns `undefined` if every option is banned.
 */
const filterBanned = (value, banned) => {
  if (value === undefined || value === null) {
    return value;
  }

  const kept = asArray(value).filter((v) => !banned?.[toId(v)]);

  if (!kept.length) {
    return undefined;
  }

  return Array.isArray(value) ? kept : kept[0];
};

const firstOf = (v) => asArray(v)[0];

/**
 * Applies the format's bans to a set, returning `null` if the set can't be made legal.
 *
 * * Banned alternatives (items, abilities, moves) are removed. A field whose every option is banned drops the set.
 * * The set is dropped if its primary (first-choice) combination hits a complex ban.
 */
export const applyBansToSet = (speciesForme, set, bans) => {
  const { species = {}, move = {}, item = {}, ability = {}, complex = [] } = bans || {};

  if (species[toId(speciesForme)]) {
    return null;
  }

  const output = { ...set };

  if (set.item !== undefined) {
    output.item = filterBanned(set.item, item);

    if (output.item === undefined) {
      return null;
    }
  }

  if (set.ability !== undefined) {
    output.ability = filterBanned(set.ability, ability);

    if (output.ability === undefined) {
      return null;
    }
  }

  if (set.moves) {
    const moves = [];

    for (const slot of set.moves) {
      const filtered = filterBanned(slot, move);

      if (filtered === undefined) {
        return null;
      }

      moves.push(filtered);
    }

    output.moves = moves;
  }

  const present = new Set([
    `species:${toId(speciesForme)}`,
    ...(output.ability ? [`ability:${toId(firstOf(output.ability))}`] : []),
    ...(output.item ? [`item:${toId(firstOf(output.item))}`] : []),
    ...(output.moves || []).map((m) => `move:${toId(firstOf(m))}`),
  ]);

  if (complex.some((combo) => combo.length > 1 && combo.every((id) => present.has(id)))) {
    return null;
  }

  return output;
};

/**
 * Builds a bundle payload (`{ [species]: { [setName]: set } }`) from a source's sets, applying conversion & bans.
 *
 * * Species already in `exclude` (e.g., ones covered by a higher priority source) are skipped when `exclude` is provided.
 */
export const buildBundlePayload = (sets, { convert = (s) => s, bans, exclude } = {}) => {
  const payload = {};

  for (const [speciesForme, named] of Object.entries(sets || {})) {
    if (exclude?.has(toId(speciesForme))) {
      continue;
    }

    for (const [name, set] of Object.entries(named || {})) {
      const legal = applyBansToSet(speciesForme, convert(set), bans);

      if (legal) {
        (payload[speciesForme] ||= {})[name] = legal;
      }
    }
  }

  return payload;
};

/** Bundles baked by `bake-soupstore-sets.mjs`. IDs must match `SoupStoreBundleIds` in `src/consts/dex/soupstore.ts`. */
export const SoupStoreBundles = {
  bss: {
    id: '5a7b3c10-50a1-4e1e-9c1a-0b55d0e0a001',
    name: 'Soup Store Season 4 (Smogon Champions BSS)',
    label: 'S4 Champions BSS',
    desc: 'Smogon Dex Champions Battle Stadium Singles sets, converted to EVs and Level 100 for Soup Store Season 4.',
  },
  natdex: {
    id: '5a7b3c10-50a1-4e1e-9c1a-0b55d0e0a002',
    name: 'Soup Store Season 4 (Smogon Gen 9 National Dex)',
    label: 'S4 NatDex',
    desc: 'Smogon Dex Gen 9 National Dex Singles sets for Soup Store Season 4.',
  },
};
