/**
 * Best-effort helpers for reading strategy sets out of Smogon Dex pages (e.g., smogon.com/dex/champions/pokemon/garchomp/).
 *
 * Each page embeds `dexSettings = { ..., injectRpcs: [...] }`, whose data includes `strategies` with `movesets`, e.g.:
 * `{ format: 'Battle Stadium Singles', movesets: [{ name, pokemon, abilities[], items[], moveslots[[{ move }]], evconfigs[{ hp, atk, ... }],
 *   ivconfigs[], natures[], teratypes[] }] }`.
 *
 * ⚠️ That shape is undocumented & is assumed here. `extractMovesets()` searches the parsed JSON for `strategies`
 * rather than relying on a fixed path, so minor layout changes are tolerated. If it stops matching, hand `bake` the
 * normalized JSON instead.
 */

export const findDexSettings = (html) => {
  const marker = 'dexSettings = ';
  const start = html.indexOf(marker);

  if (start < 0) {
    return null;
  }

  const from = start + marker.length;
  const open = html.indexOf('{', from);

  if (open < 0) {
    return null;
  }

  // walk to the matching brace, skipping over strings
  let depth = 0;
  let inString = false;

  for (let i = open; i < html.length; i++) {
    const c = html[i];

    if (inString) {
      if (c === '\\') {
        i++;
      } else if (c === '"') {
        inString = false;
      }
    } else if (c === '"') {
      inString = true;
    } else if (c === '{') {
      depth++;
    } else if (c === '}' && --depth === 0) {
      return JSON.parse(html.slice(open, i + 1));
    }
  }

  return null;
};

const collectStrategies = (node, out = []) => {
  if (Array.isArray(node)) {
    node.forEach((n) => collectStrategies(n, out));
  } else if (node && typeof node === 'object') {
    if (Array.isArray(node.movesets)) {
      out.push(node);
    }

    Object.values(node).forEach((n) => collectStrategies(n, out));
  }

  return out;
};

/** Extracts `{ [setName]: set }` (pkmn Sets shape) from a page, keeping only the strategies of the given Smogon format. */
export const extractMovesets = (html, formatName) => {
  const settings = findDexSettings(html);
  const output = {};

  if (!settings) {
    return output;
  }

  const wanted = String(formatName).toLowerCase();

  for (const strategy of collectStrategies(settings)) {
    if (String(strategy.format || '').toLowerCase() !== wanted) {
      continue;
    }

    for (const m of strategy.movesets) {
      const species = m.pokemon;

      if (!species || !m.name || !m.moveslots?.length) {
        continue;
      }

      const single = (list) => (list?.length === 1 ? list[0] : list);

      (output[species] ||= {})[m.name] = {
        ...(m.abilities?.length && { ability: single(m.abilities) }),
        ...(m.items?.length && { item: single(m.items) }),
        ...(m.natures?.length && { nature: single(m.natures) }),
        ...(m.evconfigs?.length && { evs: single(m.evconfigs) }),
        ...(m.ivconfigs?.length && { ivs: m.ivconfigs[0] }),
        moves: m.moveslots.map((slot) => {
          const names = slot.map((s) => (typeof s === 'string' ? s : s.move)).filter(Boolean);

          return names.length === 1 ? names[0] : names;
        }),
      };
    }
  }

  return output;
};
