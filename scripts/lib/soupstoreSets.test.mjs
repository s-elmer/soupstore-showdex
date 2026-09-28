import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractMovesets, findDexSettings } from './smogonDex.mjs';
import {
  SoupStoreBundles,
  applyBansToSet,
  buildBundlePayload,
  convertChampionsSet,
  statPointsToEvs,
} from './soupstoreSets.mjs';

describe('convertChampionsSet()', () => {
  it('converts Stat Points to EVs (first point 4, the rest 8), Level 50 to 100, & drops IVs and Tera', () => {
    expect(statPointsToEvs(0)).toBe(0);
    expect(statPointsToEvs(1)).toBe(4);
    expect(statPointsToEvs(32)).toBe(252);

    const converted = convertChampionsSet({
      level: 50,
      ivs: { atk: 0 },
      teraTypes: ['Fire'],
      evs: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
      nature: 'Adamant',
      moves: ['Earthquake'],
    });

    expect(converted).toEqual({
      level: 100,
      evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 }, // 2 pts = 12 EVs, trimmed to fit 510
      nature: 'Adamant',
      moves: ['Earthquake'],
    });
  });

  it('keeps spreads within 510 EVs by lowering the smallest invested stat (32/32/2 = 252/252/12)', () => {
    const { evs } = convertChampionsSet({ evs: { hp: 32, atk: 32, def: 2 } });

    expect(evs).toEqual({ hp: 252, atk: 252, def: 4, spa: 0, spd: 0, spe: 0 });
    expect(Object.values(evs).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(510);
  });

  it('converts each alternative when a set has several spreads', () => {
    const { evs } = convertChampionsSet({ evs: [{ hp: 32 }, { spe: 1 }] });

    expect(evs).toHaveLength(2);
    expect(evs[1].spe).toBe(4);
  });
});

describe('applyBansToSet()', () => {
  const bans = {
    species: { dialga: 1 },
    move: { assist: 1, hiddenpower: 1 },
    item: { quickclaw: 1 },
    ability: { moody: 1 },
    complex: [['item:alakazite', 'move:nastyplot']],
  };

  const set = { ability: 'Magic Guard', item: 'Life Orb', moves: ['Psychic', ['Nasty Plot', 'Assist']] };

  it('drops banned species', () => {
    expect(applyBansToSet('Dialga', set, bans)).toBeNull();
  });

  it('removes banned alternatives & drops sets left with an empty field', () => {
    expect(applyBansToSet('Alakazam', set, bans).moves).toEqual(['Psychic', ['Nasty Plot']]);
    expect(applyBansToSet('Alakazam', { ...set, item: ['Quick Claw'] }, bans)).toBeNull();
    expect(applyBansToSet('Alakazam', { ...set, moves: ['Psychic', 'Assist'] }, bans)).toBeNull();
    expect(applyBansToSet('Alakazam', { ...set, ability: 'Moody' }, bans)).toBeNull();
  });

  it('drops sets whose primary combination is a complex ban', () => {
    expect(applyBansToSet('Alakazam', { ...set, item: 'Alakazite' }, bans)).toBeNull();
    expect(applyBansToSet('Alakazam', { ...set, item: ['Life Orb', 'Alakazite'] }, bans)).not.toBeNull();
  });
});

describe('buildBundlePayload()', () => {
  it('skips excluded species (covered by a higher priority source)', () => {
    const sets = { Garchomp: { Set: { moves: ['Earthquake'] } }, Corviknight: { Set: { moves: ['Roost'] } } };

    expect(Object.keys(buildBundlePayload(sets, { exclude: new Set(['garchomp']) }))).toEqual(['Corviknight']);
  });
});

describe('Smogon Dex parsing', () => {
  const page = `<script>dexSettings = ${JSON.stringify({
    injectRpcs: [null, ['dump-pokemon', {
      strategies: [
        {
          format: 'BSS',
          movesets: [{
            name: 'Choice Scarf',
            pokemon: 'Garchomp',
            abilities: ['Rough Skin'],
            items: ['Choice Scarf'],
            moveslots: [[{ move: 'Earthquake' }], [{ move: 'Outrage' }, { move: 'Dragon Claw' }]],
            evconfigs: [{ atk: 32, spe: 32 }],
            natures: ['Jolly'],
          }],
        },
        { format: 'OU', movesets: [{ name: 'Other', pokemon: 'Garchomp', moveslots: [[{ move: 'Stealth Rock' }]] }] },
      ],
    }]],
  })}</script>`;

  it('finds dexSettings', () => {
    expect(findDexSettings(page).injectRpcs).toHaveLength(2);
    expect(findDexSettings('<html></html>')).toBeNull();
  });

  it('extracts the movesets of the requested format only', () => {
    expect(extractMovesets(page, 'BSS')).toEqual({
      Garchomp: {
        'Choice Scarf': {
          ability: 'Rough Skin',
          item: 'Choice Scarf',
          nature: 'Jolly',
          evs: { atk: 32, spe: 32 },
          moves: ['Earthquake', ['Outrage', 'Dragon Claw']],
        },
      },
    });
  });
});

describe('bundle IDs', () => {
  it('match the ones the extension includes for Soup Store formats', () => {
    const consts = readFileSync(new URL('../../src/consts/dex/soupstore.ts', import.meta.url), 'utf8');
    const ids = Object.values(SoupStoreBundles).map((b) => b.id);

    ids.forEach((id) => expect(consts).toContain(id));
    expect(ids.indexOf(SoupStoreBundles.bss.id)).toBeLessThan(ids.indexOf(SoupStoreBundles.natdex.id));
  });
});
