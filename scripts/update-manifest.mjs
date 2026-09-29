#!/usr/bin/env node
/**
 * Adds a release to the Firefox update manifest (`updates.json`) that installed copies of the extension check for updates.
 *
 * Usage:
 *   node scripts/update-manifest.mjs --file updates.json --id showdex@soupstore.dev --version 1.4.3 \
 *     --link https://github.com/OWNER/REPO/releases/download/v1.4.3/soupstore-showdex-1.4.3.xpi --xpi path/to/signed.xpi
 *
 * * Creates the file if it doesn't exist, & replaces the entry if that version is already listed.
 * * Format: https://extensionworkshop.com/documentation/manage/updating-your-extension/
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const versionParts = (v) => String(v).split('.').map((n) => parseInt(n, 10) || 0);

/** Compares dotted numeric versions, e.g., `1.4.10` is newer than `1.4.9`. */
export const compareVersions = (a, b) => {
  const [pa, pb] = [versionParts(a), versionParts(b)];

  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);

    if (diff) {
      return diff;
    }
  }

  return 0;
};

/** Returns a new update manifest with the release added, keeping the versions sorted oldest to newest. */
export const addUpdate = (manifest, id, { version, link, hash }) => {
  const existing = manifest?.addons?.[id]?.updates || [];
  const entry = { version, update_link: link, ...(hash && { update_hash: hash }) };

  return {
    addons: {
      ...manifest?.addons,
      [id]: {
        updates: [...existing.filter((u) => u.version !== version), entry].sort((a, b) => compareVersions(a.version, b.version)),
      },
    },
  };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      id: { type: 'string' },
      version: { type: 'string' },
      link: { type: 'string' },
      xpi: { type: 'string' },
    },
  });

  if (!values.file || !values.id || !values.version || !values.link) {
    console.error('usage: update-manifest.mjs --file <updates.json> --id <addon id> --version <x.y.z> --link <https url> [--xpi <file>]');
    process.exit(1);
  }

  if (!values.link.startsWith('https://')) {
    console.error('The update link must be an https:// URL.');
    process.exit(1);
  }

  const current = existsSync(values.file) ? JSON.parse(readFileSync(values.file, 'utf8')) : {};
  // Firefox checks the download against this hash before installing the update
  const hash = values.xpi ? `sha256:${createHash('sha256').update(readFileSync(values.xpi)).digest('hex')}` : undefined;
  const next = addUpdate(current, values.id, { version: values.version, link: values.link, hash });

  writeFileSync(values.file, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Listed ${values.id} ${values.version} in ${values.file}`);
}
