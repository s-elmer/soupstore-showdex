/**
 * Prunes preset sets against a Pokemon Showdown server's team validator (e.g., `soupstore-ps-server`), which is the
 * authority on what's legal in `gen9soupstoreseason4` (banlists, item/species legality, learnsets, complex bans, ...).
 *
 * Sets may list alternatives (`ability`/`item`/`nature`/`evs` as arrays, or several options per move slot). The first
 * of each is validated as the "primary" set; a validator problem that names an alternative removes just that
 * alternative, and any other problem drops the whole set.
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const asArray = (v) => (Array.isArray(v) ? v : [v]);
const shrink = (list) => (list.length === 1 ? list[0] : list);
const IVS = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
const ZERO_EVS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

// the validator wants a full team, but we validate one set at a time
const IGNORED_PROBLEMS = /^You must bring at least \d+ Pok/;

export const loadServerValidator = (serverDir, formatId) => {
  const require = createRequire(import.meta.url);
  const { TeamValidator } = require(resolve(serverDir, 'dist/sim/team-validator'));

  return TeamValidator.get(formatId);
};

const problemsOf = (validator, speciesForme, fields) => {
  const set = {
    name: '',
    species: speciesForme,
    level: 100,
    nature: fields.natures[0] || 'Hardy',
    ability: fields.abilities[0] || '',
    item: fields.items[0] || '',
    evs: { ...ZERO_EVS, ...fields.evs[0] },
    ivs: { ...IVS, ...fields.ivs },
    moves: fields.moveslots.map((slot) => slot[0]),
  };

  return (validator.validateTeam([set]) || []).filter((p) => !IGNORED_PROBLEMS.test(p));
};

/** Returns the legal version of the set (with illegal alternatives removed), or `null` if it can't be made legal. */
export const legalizeSet = (validator, speciesForme, set) => {
  const fields = {
    abilities: set.ability === undefined ? [] : asArray(set.ability),
    items: set.item === undefined ? [] : asArray(set.item),
    natures: set.nature === undefined ? [] : asArray(set.nature),
    evs: set.evs === undefined ? [{}] : asArray(set.evs),
    ivs: set.ivs || {},
    moveslots: (set.moves || []).map((slot) => asArray(slot)),
  };

  // each pass removes the alternatives named by the validator's problems; bounded since every pass removes at least one
  for (let pass = 0; pass < 12; pass++) {
    if (fields.moveslots.some((slot) => !slot.length) || (set.item !== undefined && !fields.items.length)
      || (set.ability !== undefined && !fields.abilities.length)) {
      return null;
    }

    const problems = problemsOf(validator, speciesForme, fields);

    if (!problems.length) {
      return {
        ...set,
        ...(set.ability !== undefined && { ability: shrink(fields.abilities) }),
        ...(set.item !== undefined && { item: shrink(fields.items) }),
        moves: fields.moveslots.map(shrink),
      };
    }

    const text = problems.join('\n').toLowerCase();
    const named = (v) => !!v && text.includes(String(v).toLowerCase());
    let removed = false;

    // a problem mentioning several of the set's own values is a combination ban: drop the move, the more replaceable one
    const items = fields.items.filter(named);
    const abilities = fields.abilities.filter(named);
    const slots = fields.moveslots.map((slot, i) => [i, slot[0]]).filter(([, m]) => named(m));

    if (items.length + abilities.length + slots.length > 1 && items.length + abilities.length === 1 && slots.length === 1) {
      const [i] = slots[0];

      fields.moveslots[i].shift();
      removed = true;
    } else {
      if (items.length && fields.items.length) {
        fields.items = fields.items.filter((v) => !items.includes(v));
        removed = true;
      }

      if (abilities.length) {
        fields.abilities = fields.abilities.filter((v) => !abilities.includes(v));
        removed = true;
      }

      for (const [i, m] of slots) {
        fields.moveslots[i] = fields.moveslots[i].filter((v) => v !== m);
        removed = true;
      }
    }

    if (!removed) {
      return null; // e.g., the species itself is banned, or the spread is illegal
    }
  }

  return null;
};

/** Applies `legalizeSet()` to every set of a payload (`{ [species]: { [setName]: set } }`). */
export const legalizePayload = (validator, payload) => {
  const output = {};
  let dropped = 0;

  for (const [speciesForme, named] of Object.entries(payload)) {
    for (const [name, set] of Object.entries(named)) {
      const legal = legalizeSet(validator, speciesForme, set);

      if (legal) {
        (output[speciesForme] ||= {})[name] = legal;
      } else {
        dropped++;
      }
    }
  }

  return { payload: output, dropped };
};
