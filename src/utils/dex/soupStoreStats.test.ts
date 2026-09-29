import { describe, expect, it } from 'vitest';
import { calcPokemonStat } from '@showdex/utils/calc/calcPokemonStat';
import { getDefaultSpreadValue } from './getDefaultSpreadValue';

// mirrors soupstore-ps-server's test/sim/soupstore/season4.js: Jolly Garchomp, 4 HP / 252 Atk / 252 Spe EVs, all 31 IVs, Level 100
const SOUP = 'gen9soupstoreseason4';

describe('Soup Store Season 4 stats', () => {
  it('uses the mainline Level 100 EV/IV formula, not Champions Stat Points', () => {
    expect(calcPokemonStat(SOUP, 'hp', 108, 31, 4, 100, 'Jolly')).toBe(358);
    expect(calcPokemonStat(SOUP, 'atk', 130, 31, 252, 100, 'Jolly')).toBe(359);
    expect(calcPokemonStat(SOUP, 'spe', 102, 31, 252, 100, 'Jolly')).toBe(333);
  });

  it('defaults to 0 EVs & 31 IVs', () => {
    expect(getDefaultSpreadValue('ev', SOUP)).toBe(0);
    expect(getDefaultSpreadValue('iv', SOUP)).toBe(31);
  });
});
