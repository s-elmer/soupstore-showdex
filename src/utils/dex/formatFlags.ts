import { formatId } from '@showdex/utils/core';

/**
 * Detects Soup Store draft league formats, e.g., `'gen9soupstoreseason4'`.
 *
 * * Soup Store formats use Pokemon Champions data & mechanics, but the mainline stat rules
 *   (Level 100, EVs up to 510 in steps of 4, IVs) & have Terastallization banned.
 *
 * @since 1.4.3
 */
export const detectSoupStoreFormat = (
  format: string,
): boolean => typeof format === 'string' && formatId(format).includes('soupstore');

/**
 * Whether the `format` uses the Pokemon Champions dex (`Dex.mod('champions')`), teambuilder table, & calc mechanics.
 *
 * * True for Champions formats & Soup Store formats.
 *
 * @since 1.4.3
 */
export const usesChampionsData = (
  format: string,
): boolean => typeof format === 'string'
  && (format.includes('champions') || detectSoupStoreFormat(format));

/**
 * Whether the `format` uses Champions Stat Points (0-32) in lieu of EVs/IVs.
 *
 * * True for Champions formats only, *not* Soup Store formats, which use mainline EVs/IVs at Level 100.
 *
 * @since 1.4.3
 */
export const usesStatPoints = (
  format: string,
): boolean => typeof format === 'string'
  && format.includes('champions')
  && !detectSoupStoreFormat(format);

/**
 * Whether Terastallization is unavailable in the `format`.
 *
 * * True for Champions formats & Soup Store formats.
 *
 * @since 1.4.3
 */
export const isTeraBanned = (
  format: string,
): boolean => usesChampionsData(format);
