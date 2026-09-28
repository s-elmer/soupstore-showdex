import { describe, expect, it } from 'vitest';
import { detectSoupStoreFormat, isTeraBanned, usesChampionsData, usesStatPoints } from './formatFlags';

const SOUP = 'gen9soupstoreseason4';

describe('format flags', () => {
  it('detects Soup Store formats', () => {
    expect(detectSoupStoreFormat(SOUP)).toBe(true);
    expect(detectSoupStoreFormat('[Gen 9] Soup Store Season 4')).toBe(true);
    expect(detectSoupStoreFormat('gen9ou')).toBe(false);
    expect(detectSoupStoreFormat('gen9championsbss')).toBe(false);
    expect(detectSoupStoreFormat(null)).toBe(false);
  });

  it('uses Champions data for both Champions & Soup Store formats', () => {
    expect(usesChampionsData(SOUP)).toBe(true);
    expect(usesChampionsData('gen9championsbss')).toBe(true);
    expect(usesChampionsData('gen9nationaldex')).toBe(false);
  });

  it('uses Stat Points for Champions formats only -- Soup Store keeps mainline EVs/IVs', () => {
    expect(usesStatPoints('gen9championsbss')).toBe(true);
    expect(usesStatPoints(SOUP)).toBe(false);
    expect(usesStatPoints('gen9ou')).toBe(false);
  });

  it('bans Tera in Champions & Soup Store formats', () => {
    expect(isTeraBanned(SOUP)).toBe(true);
    expect(isTeraBanned('gen9championsvgc2026')).toBe(true);
    expect(isTeraBanned('gen9ou')).toBe(false);
  });
});
