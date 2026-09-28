import { type DropdownOption } from '@showdex/components/form';
import { formatId } from '@showdex/utils/core';
import { type FormatBanCategory, getFormatBans, isFormatBanned } from '@showdex/utils/dex';

/**
 * Moves every option whose value is banned in the `format` into a trailing group, e.g., `'Banned'`.
 *
 * * Options are only *moved* (unless `config.hide` is `true`), so a banned value can still be picked (e.g., when calcing
 *   an opponent's set that's illegal in the format).
 * * No-op for formats without bans.
 *
 * @since 1.4.3
 */
export const partitionBannedOptions = <TValue extends string>(
  format: string,
  category: FormatBanCategory,
  options: DropdownOption<TValue>[],
  config: {
    /** Label of the trailing group holding the banned options. */
    label: string;
    /** If true, banned options are dropped instead of moved into the trailing group. */
    hide?: boolean;
  },
): DropdownOption<TValue>[] => {
  if (!options?.length || !format || !getFormatBans(format)) {
    return options;
  }

  const banned: DropdownOption<TValue>[] = [];
  const seen = new Set<string>();

  const output = options.map((group) => {
    if (!Array.isArray(group?.options)) {
      return group;
    }

    const kept = group.options.filter((option) => {
      if (!isFormatBanned(format, category, option?.value)) {
        return true;
      }

      if (!seen.has(formatId(option.value))) {
        seen.add(formatId(option.value));
        banned.push(option);
      }

      return false;
    });

    return kept.length === group.options.length ? group : { ...group, options: kept };
  }).filter((group) => !Array.isArray(group?.options) || group.options.length);

  if (banned.length && !config?.hide) {
    output.push({ label: config?.label, options: banned });
  }

  return output;
};
