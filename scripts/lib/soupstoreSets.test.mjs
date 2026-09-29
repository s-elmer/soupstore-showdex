import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractMovesets, extractMovesetsByFormat, findDexSettings } from './smogonDex.mjs';
import {
  SetSourcePriority,
  SoupStoreBundles,
  buildAllBundles,
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

describe('buildBundlePayload()', () => {
  it('skips excluded species (covered by a higher priority source)', () => {
    const sets = { Garchomp: { Set: { moves: ['Earthquake'] } }, Corviknight: { Set: { moves: ['Roost'] } } };

    expect(Object.keys(buildBundlePayload(sets, { exclude: new Set(['garchomp']) }))).toEqual(['Corviknight']);
  });

  it('skips sets of banned species, but keeps banned abilities, items & moves so they can be marked & swapped', () => {
    const banned = { Set: { ability: 'Moody', item: 'Quick Claw', moves: ['Assist', ['Hidden Power', 'Psychic']] } };
    const payload = buildBundlePayload(
      { Dialga: { Set: { moves: ['Roar of Time'] } }, Alakazam: banned },
      { bans: { species: { dialga: 1 }, move: { assist: 1 }, item: { quickclaw: 1 }, ability: { moody: 1 } } },
    );

    expect(payload).toEqual({ Alakazam: banned });
  });
});

describe('buildAllBundles()', () => {
  const set = (move) => ({ moves: [move] });
  const downloads = {
    champions: {
      'Battle Stadium Singles': { Garchomp: { Bss: set('Earthquake') } },
    },
    sv: {
      'National Dex': { Garchomp: { NdOu: set('Outrage') }, Clefable: { NdOu: set('Moonblast') } },
      'National Dex Ubers': { Clefable: { NdUbers: set('Calm Mind') }, Mewtwo: { NdUbers: set('Psystrike') } },
      'National Dex UU': { Mewtwo: { NdUu: set('Recover') }, Hydreigon: { NdUu: set('Draco Meteor') } },
      'National Dex RU': { Hydreigon: { NdRu: set('Dark Pulse') }, Absol: { NdRu: set('Knock Off') } },
      OU: { Absol: { Ou: set('Swords Dance') }, Toxapex: { Ou: set('Scald') } },
      Uber: { Toxapex: { Ubers: set('Recover') }, Kyogre: { Ubers: set('Origin Pulse') } },
      ZU: { Kyogre: { Zu: set('Surf') }, Wobbuffet: { Zu: set('Counter') } },
    },
  };

  const names = (payload) => Object.fromEntries(Object.entries(payload).map(([sp, sets]) => [sp, Object.keys(sets)]));

  it('lists the sources in the requested order', () => {
    expect(SetSourcePriority.map((s) => s.format)).toEqual([
      'Battle Stadium Singles',
      'National Dex', 'National Dex Ubers', 'National Dex UU', 'National Dex RU',
      'OU', 'Uber', 'UU', 'RU', 'NU', 'PU', 'ZU',
    ]);
    expect(SetSourcePriority[0]).toMatchObject({ gen: 'champions', bundle: 'bss' });
    SetSourcePriority.slice(1).forEach((s) => expect(s).toMatchObject({ gen: 'sv', bundle: 'natdex' }));
  });

  it('gives each Pokemon the sets of the first source that has any, and nothing from later ones', () => {
    const { payloads } = buildAllBundles(downloads);

    expect(names(payloads.bss)).toEqual({ Garchomp: ['Bss'] }); // BSS beats National Dex OU
    expect(names(payloads.natdex)).toEqual({
      Clefable: ['NdOu'], // National Dex OU beats National Dex Ubers
      Mewtwo: ['NdUbers'], // Ubers beats UU
      Hydreigon: ['NdUu'], // UU beats RU
      Absol: ['NdRu'], // National Dex RU beats Gen 9 OU
      Toxapex: ['Ou'], // Gen 9 OU beats Gen 9 Ubers
      Kyogre: ['Ubers'], // Gen 9 Ubers beats ZU
      Wobbuffet: ['Zu'], // only found in the lowest tier
    });
  });

  it('converts only the Champions sets, and skips banned species in every source', () => {
    const { payloads } = buildAllBundles({
      champions: { 'Battle Stadium Singles': { Lucario: { A: { level: 50, evs: { atk: 32 }, moves: ['Close Combat'] } } } },
      sv: { 'National Dex': { Mewtwo: { B: { evs: { atk: 252 }, moves: ['Psystrike'] } } }, OU: { Garchomp: { C: set('Earthquake') } } },
    }, { bans: { species: { mewtwo: 1 } } });

    expect(payloads.bss.Lucario.A).toMatchObject({ level: 100, evs: { atk: 252 } });
    expect(payloads.natdex.Mewtwo).toBeUndefined();
    expect(payloads.natdex.Garchomp.C).toEqual(set('Earthquake'));
  });

  it('reports formats that were not in the download, e.g., a wrong name', () => {
    const { report } = buildAllBundles(downloads);

    expect(report.find((r) => r.format === 'NU')).toMatchObject({ missing: true, species: [] });
    expect(report.find((r) => r.format === 'ZU')).toMatchObject({ missing: false, species: ['Wobbuffet'] });
  });

  it('matches format names regardless of case', () => {
    const { payloads } = buildAllBundles({ sv: { 'national dex ubers': { Mewtwo: { A: set('Psystrike') } } } });

    expect(Object.keys(payloads.natdex)).toEqual(['Mewtwo']);
  });
});

describe('Smogon Dex parsing', () => {
  const page = `<script>dexSettings = ${JSON.stringify({
    injectRpcs: [null, ['dump-pokemon', {
      strategies: [
        {
          format: 'Battle Stadium Singles',
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

  it('extracts every format at once', () => {
    const byFormat = extractMovesetsByFormat(page);

    expect(Object.keys(byFormat)).toEqual(['Battle Stadium Singles', 'OU']);
    expect(byFormat.OU.Garchomp.Other.moves).toEqual(['Stealth Rock']);
  });

  it('extracts the movesets of the requested format only', () => {
    expect(extractMovesets(page, 'battle stadium singles')).toEqual({
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
