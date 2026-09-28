import { formatId, nonEmptyObject } from '@showdex/utils/core';
import { detectSoupStoreFormat } from './formatFlags';
import { getGenlessFormat } from './getGenlessFormat';
import { guessTableFormatKey } from './guessTableFormatKey';

export type FormatBanCategory = 'species' | 'move' | 'item' | 'ability';

export interface FormatBans {
  species: Record<string, 1>;
  move: Record<string, 1>;
  item: Record<string, 1>;
  ability: Record<string, 1>;
  /**
   * Banned combinations, e.g., `[['item:alakazite', 'move:nastyplot']]`.
   *
   * * Every entry in a combination must be present for it to apply.
   */
  complex: string[][];
}

/**
 * Reads the bans for the `format` from the client's `BattleTeambuilderTable`.
 *
 * * Currently only Soup Store formats are supported, whose bans are emitted by the Soup Store client's `build-indexes`.
 * * Returns `null` if the format has no bans or the client doesn't provide them (e.g., an older client build),
 *   in which case nothing should be filtered.
 *
 * @since 1.4.3
 */
export const getFormatBans = (
  format: string,
): FormatBans => {
  if (!format || !detectSoupStoreFormat(format) || !nonEmptyObject(BattleTeambuilderTable)) {
    return null;
  }

  const genless = formatId(getGenlessFormat(format));
  const tableKey = guessTableFormatKey(format);
  const table = (BattleTeambuilderTable[tableKey] || BattleTeambuilderTable) as Showdown.BattleTeambuilderGenTable;

  if (!genless || !table) {
    return null;
  }

  const bans: FormatBans = {
    species: table.metagameBans?.[genless] || {},
    move: table.metagameMoveBans?.[genless] || {},
    item: table.metagameItemBans?.[genless] || {},
    ability: table.metagameAbilityBans?.[genless] || {},
    complex: table.metagameComplexBans?.[genless] || [],
  };

  const empty = !nonEmptyObject(bans.species)
    && !nonEmptyObject(bans.move)
    && !nonEmptyObject(bans.item)
    && !nonEmptyObject(bans.ability)
    && !bans.complex.length;

  return empty ? null : bans;
};

/**
 * Whether the `name` (of the specified `category`) is banned outright in the `format`.
 *
 * @since 1.4.3
 */
export const isFormatBanned = (
  format: string,
  category: FormatBanCategory,
  name: string,
): boolean => {
  if (!name) {
    return false;
  }

  const bans = getFormatBans(format);

  return !!bans?.[category]?.[formatId(name)];
};

/**
 * Finds the banned combinations (e.g., a Mega Stone + a move) that apply to the provided Pokemon `set`.
 *
 * * Returns the matching combinations, each as a list of IDs like `['item:alakazite', 'move:nastyplot']`.
 *
 * @since 1.4.3
 */
export const findComplexBans = (
  format: string,
  set: {
    speciesForme?: string;
    ability?: string;
    item?: string;
    moves?: string[];
  },
): string[][] => {
  const bans = getFormatBans(format);

  if (!bans?.complex.length || !set) {
    return [];
  }

  const speciesId = formatId(set.speciesForme || '');
  const present = new Set<string>();

  if (speciesId) {
    present.add(`species:${speciesId}`);
  }

  if (set.ability) {
    present.add(`ability:${formatId(set.ability)}`);
  }

  if (set.item) {
    present.add(`item:${formatId(set.item)}`);
  }

  set.moves?.filter(Boolean).forEach((m) => present.add(`move:${formatId(m)}`));

  return bans.complex.filter((combo) => combo.length > 1 && combo.every((id) => present.has(id)));
};

/**
 * Lists everything in the provided Pokemon `set` that's banned in the `format`, for display.
 *
 * * Includes banned species, abilities, items, moves & banned combinations (e.g., `'Alakazite + Nasty Plot'`).
 * * Returns an empty array if nothing is banned or the format has no ban data.
 *
 * @since 1.4.3
 */
export const findFormatViolations = (
  format: string,
  set: {
    speciesForme?: string;
    ability?: string;
    item?: string;
    moves?: string[];
  },
): string[] => {
  if (!set || !getFormatBans(format)) {
    return [];
  }

  const violations: string[] = [];

  if (isFormatBanned(format, 'species', set.speciesForme)) {
    violations.push(set.speciesForme);
  }

  if (isFormatBanned(format, 'ability', set.ability)) {
    violations.push(set.ability);
  }

  if (isFormatBanned(format, 'item', set.item)) {
    violations.push(set.item);
  }

  set.moves?.filter((m) => isFormatBanned(format, 'move', m)).forEach((m) => violations.push(m));

  findComplexBans(format, set).forEach((combo) => {
    // e.g., 'item:alakazite' -> 'alakazite', matched back to the set's own (nicely formatted) names
    const names = combo.map((id) => {
      const [kind, value] = id.split(':');
      const own = {
        species: [set.speciesForme],
        ability: [set.ability],
        item: [set.item],
        move: set.moves || [],
      }[kind]?.find((n) => formatId(n || '') === value);

      return own || value;
    });

    violations.push(names.join(' + '));
  });

  return violations;
};
