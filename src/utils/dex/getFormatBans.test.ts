import {
 afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
 findComplexBans, findFormatViolations, getFormatBans, isFormatBanned,
} from './getFormatBans';
import { getDexForFormat } from './getDexForFormat';
import { guessTableFormatKey } from './guessTableFormatKey';

const SOUP = 'gen9soupstoreseason4';

const table = {
  metagameBans: { soupstoreseason4: { dialga: 1, zygardecomplete: 1 } },
  metagameMoveBans: { soupstoreseason4: { hiddenpower: 1, assist: 1 } },
  metagameItemBans: { soupstoreseason4: { quickclaw: 1 } },
  metagameAbilityBans: { soupstoreseason4: { moody: 1 } },
  metagameComplexBans: {
    soupstoreseason4: [
      ['item:alakazite', 'move:nastyplot'],
      ['species:zygarde10', 'ability:powerconstruct'],
    ],
  },
};

describe('Soup Store format data', () => {
  beforeEach(() => {
    vi.stubGlobal('BattleTeambuilderTable', { natdexchampions: table, champions: {}, gen9natdex: {} });
    vi.stubGlobal('Dex', { gen: 9, forGen: (gen: number) => ({ gen }), mod: (modid: string) => ({ modid }) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the champions Dex mod', () => {
    expect(getDexForFormat(SOUP)).toEqual({ modid: 'champions' });
    expect(getDexForFormat('gen9nationaldex')).toEqual({ gen: 9 });
  });

  it('sources formes from the natdexchampions table, falling back to champions', () => {
    expect(guessTableFormatKey(SOUP)).toBe('natdexchampions');

    vi.stubGlobal('BattleTeambuilderTable', { champions: {} });
    expect(guessTableFormatKey(SOUP)).toBe('champions');
  });

  it('reads bans from the table', () => {
    expect(isFormatBanned(SOUP, 'species', 'Dialga')).toBe(true);
    expect(isFormatBanned(SOUP, 'move', 'Hidden Power')).toBe(true);
    expect(isFormatBanned(SOUP, 'item', 'Quick Claw')).toBe(true);
    expect(isFormatBanned(SOUP, 'ability', 'Moody')).toBe(true);
    expect(isFormatBanned(SOUP, 'move', 'Earthquake')).toBe(false);
    expect(isFormatBanned('gen9ou', 'move', 'Hidden Power')).toBe(false);
  });

  it('finds nothing to filter when the client has no ban data', () => {
    vi.stubGlobal('BattleTeambuilderTable', { natdexchampions: {} });

    expect(getFormatBans(SOUP)).toBeNull();
    expect(isFormatBanned(SOUP, 'species', 'Dialga')).toBe(false);
  });

  it('finds banned combinations', () => {
    expect(findComplexBans(SOUP, {
      speciesForme: 'Alakazam-Mega',
      item: 'Alakazite',
      moves: ['Psychic', 'Nasty Plot'],
    })).toEqual([['item:alakazite', 'move:nastyplot']]);

    expect(findComplexBans(SOUP, { speciesForme: 'Alakazam', item: 'Life Orb', moves: ['Nasty Plot'] })).toEqual([]);

    expect(findComplexBans(SOUP, {
      speciesForme: 'Zygarde-10%',
      ability: 'Power Construct',
    })).toEqual([['species:zygarde10', 'ability:powerconstruct']]);
  });

  it('lists everything banned in a set', () => {
    expect(findFormatViolations(SOUP, {
      speciesForme: 'Alakazam-Mega',
      ability: 'Moody',
      item: 'Alakazite',
      moves: ['Psychic', 'Nasty Plot', 'Assist'],
    })).toEqual(['Moody', 'Assist', 'Alakazite + Nasty Plot']);

    expect(findFormatViolations(SOUP, { speciesForme: 'Dialga', moves: ['Earthquake'] })).toEqual(['Dialga']);
    expect(findFormatViolations('gen9ou', { speciesForme: 'Dialga' })).toEqual([]);
  });
});
