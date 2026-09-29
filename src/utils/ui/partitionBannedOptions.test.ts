import {
 afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { partitionBannedOptions } from './partitionBannedOptions';

const SOUP = 'gen9soupstoreseason4';

const options = [
  { label: 'Learnset', options: [{ value: 'Earthquake' }, { value: 'Assist' }] },
  { label: 'Hidden Power', options: [{ value: 'Hidden Power Fire' }] },
  { label: 'Only Banned', options: [{ value: 'Assist' }] },
];

describe('partitionBannedOptions()', () => {
  beforeEach(() => {
    vi.stubGlobal('BattleTeambuilderTable', {
      natdexchampions: { metagameMoveBans: { soupstoreseason4: { assist: 1, hiddenpowerfire: 1 } } },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('moves banned options into a trailing group, dropping emptied groups & duplicates', () => {
    expect(partitionBannedOptions(SOUP, 'move', options, 'Banned')).toEqual([
      { label: 'Learnset', options: [{ value: 'Earthquake' }] },
      { label: 'Banned', options: [{ value: 'Assist' }, { value: 'Hidden Power Fire' }] },
    ]);
  });

  it('leaves other formats alone', () => {
    expect(partitionBannedOptions('gen9ou', 'move', options, 'Banned')).toBe(options);
  });
});
