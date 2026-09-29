/**
 * IDs of the bundled Soup Store preset bundles, in priority order.
 *
 * * Must match `SoupStoreBundles` in `scripts/bake-soupstore-sets.mjs`, which bakes the bundle files & registers them in `buns.json`.
 * * Automatically included for Soup Store formats, regardless of the user's `includePresetsBundles` setting.
 *
 * @since 1.4.3
 */
export const SoupStoreBundleIds: string[] = [
  '5a7b3c10-50a1-4e1e-9c1a-0b55d0e0a001', // Smogon Dex, Champions BSS (converted to EVs & Level 100)
  '5a7b3c10-50a1-4e1e-9c1a-0b55d0e0a002', // Smogon Dex, Gen 9 National Dex
];
