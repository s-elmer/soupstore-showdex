import { describe, expect, it } from 'vitest';
import { addUpdate, compareVersions } from './update-manifest.mjs';

const ID = 'showdex@soupstore.dev';
const entry = (version) => ({ version, link: `https://example.com/${version}.xpi`, hash: `sha256:${version}` });

describe('update-manifest', () => {
  it('compares versions numerically', () => {
    expect(compareVersions('1.4.10', '1.4.9')).toBeGreaterThan(0);
    expect(compareVersions('1.4.2', '1.4.2')).toBe(0);
    expect(compareVersions('1.5', '1.5.1')).toBeLessThan(0);
  });

  it('creates the manifest with the first release, in the format Firefox expects', () => {
    expect(addUpdate({}, ID, entry('1.4.3'))).toEqual({
      addons: { [ID]: { updates: [{ version: '1.4.3', update_link: 'https://example.com/1.4.3.xpi', update_hash: 'sha256:1.4.3' }] } },
    });
  });

  it('keeps earlier releases sorted & replaces a re-listed version', () => {
    let manifest = addUpdate({}, ID, entry('1.4.10'));

    manifest = addUpdate(manifest, ID, entry('1.4.9'));
    manifest = addUpdate(manifest, ID, { ...entry('1.4.10'), link: 'https://example.com/new.xpi' });

    expect(manifest.addons[ID].updates.map((u) => u.version)).toEqual(['1.4.9', '1.4.10']);
    expect(manifest.addons[ID].updates[1].update_link).toBe('https://example.com/new.xpi');
  });

  it('omits the hash when there is none', () => {
    expect(addUpdate({}, ID, { version: '1.0.0', link: 'https://example.com/a.xpi' }).addons[ID].updates[0]).not.toHaveProperty('update_hash');
  });
});
