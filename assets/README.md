# Ask Your Notes identity

The mark combines a folded note with a conversation tail. It is drawn as two
paths, without text, external fonts, filters, or raster elements, so the same
geometry works in a small Obsidian toolbar icon and a project avatar.

| File | Use |
| --- | --- |
| `logo-mark.svg` | Vector master, transparent, monochrome `currentColor`, 100 × 100 |
| `logo.svg` / `logo.png` | Primary project icon, violet tile, 512 × 512 |
| `logo-dark.svg` / `logo-dark.png` | Dark-background project icon, 512 × 512 |

The plugin bundles the monochrome master through `src/brand.ts` and registers it
with Obsidian's icon API. Ribbon and tab icons inherit the host icon color; the
chat header and empty state use Obsidian's `--text-accent`. No brand palette is
imposed on the plugin interface.

The README selects a light or dark asset through `<picture>`. All assets are
covered by the repository's MIT license.

Run `npm run build:brand` after changing the master to regenerate both branded
SVG exports. PNGs are 512 × 512 Chromium canvas exports of those SVGs; refresh
them when the vector geometry changes.
