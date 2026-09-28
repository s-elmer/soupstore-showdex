import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SoupStoreBundles, toId } from './soupstoreSets.mjs';

const dir = new URL('../../src/assets/bundles/', import.meta.url);
const readJson = (name) => JSON.parse(readFileSync(new URL(name, dir), 'utf8'));
const buns = readJson('buns.json').payload.presets;

const payloadOf = (key) => readJson(`${SoupStoreBundles[key].id}.json`).payload;
const asArray = (v) => (Array.isArray(v) ? v : [v]);

describe('baked Soup Store bundles', () => {
  it('are registered for Gen 9 Soup Store Season 4 & enabled', () => {
    Object.values(SoupStoreBundles).forEach(({ id }) => {
      expect(buns[id]).toMatchObject({ id, ntt: 'presets', gen: 9, format: 'soupstoreseason4', disabled: false });
    });
  });

  it('have BSS and National Dex covering different species (BSS takes priority)', () => {
    const bss = new Set(Object.keys(payloadOf('bss')).map(toId));
    const overlap = Object.keys(payloadOf('natdex')).filter((s) => bss.has(toId(s)));

    expect(bss.size).toBeGreaterThan(0);
    expect(overlap).toEqual([]);
  });

  it.each(['bss', 'natdex'])('%s sets use Level 100 EVs (max 252 each, 510 total), never Stat Points, and have no Tera', (key) => {
    const payload = payloadOf(key);

    expect(Object.keys(payload).length).toBeGreaterThan(0);

    for (const sets of Object.values(payload)) {
      for (const set of Object.values(sets)) {
        expect(set.level === undefined || set.level === 100).toBe(true);
        expect(set.teraTypes).toBeUndefined();
        expect(set.moves.length).toBeGreaterThan(0);

        for (const evs of asArray(set.evs || {})) {
          const values = Object.values(evs);

          expect(Math.max(0, ...values)).toBeLessThanOrEqual(252);
          expect(values.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(510);
        }
      }
    }
  });

  it('BSS sets converted from Stat Points (e.g., 32 points -> 252 EVs)', () => {
    const maxEv = Math.max(...Object.values(payloadOf('bss')).flatMap((sets) => (
      Object.values(sets).flatMap((s) => asArray(s.evs || {}).flatMap((e) => Object.values(e)))
    )));

    expect(maxEv).toBe(252);
  });
});
