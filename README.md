# Zen Automatic Sidebar Text Sync Fix

Fixes stale sidebar and tab text colors after macOS switches between light and dark appearance.

## What it changes

Zen's default workspace background uses declarative `light-dark()` colors, but the foreground color can remain as an old inline `--toolbox-textcolor` value on `zen-workspace`. This mod overrides that value only while the workspace is using Zen's default/automatic theme:

- light appearance: dark text
- dark appearance: light text
- private and unsynced windows: left unchanged

The mod uses CSS plus a small Sine `.uc.js` runtime script. The script runs only in Zen's main browser window and does not modify browser application files. The runtime synchronizer also forces the light/dark `color-scheme` on the browser, toolbox, workspace, tab strip, and tab content so Zen's `light-dark()` and selected-tab rules use the same appearance as macOS.

## Installation

The official Zen Mods importer downloads the CSS and preference files from the URLs in `theme.json`. Host this directory at a public HTTPS URL, update the URLs in `theme.json` and `import.json`, then import `import.json` from **Settings → Mods → Import Mods**.

For local testing, Zen's current importer sends imported IDs to the official theme-store endpoint instead of using local asset paths. Therefore the `import.json` file works only after its URLs are replaced with public HTTPS URLs, or when the mod has been submitted to the official Zen theme store. For a local-only install, use the local sideload method below.

### Local sideload

1. Open `about:support` and open the active **Profile Folder**.
2. Create `chrome/zen-themes/8154795f-86ee-40c5-b980-2c843d6df65f/` (the folder name must equal the mod ID).
3. Copy `chrome.css`, `preferences.json`, and the `js/` directory into that folder.
4. Merge the object in `local-zen-themes-entry.json` into the profile's `zen-themes.json` object. Do not add it as an array item.
5. Fully restart Zen, then enable the mod under **Settings → Mods**.

## Limitations

The runtime synchronizer targets normal Zen windows. It deliberately ignores private and unsynced windows, where Zen intentionally uses fixed colors. It uses the current system appearance as the foreground source because Zen's `zen-should-be-dark-mode` marker can remain stale during macOS theme changes. It also watches and corrects the related `color-scheme` values and tab-content variables after Zen rewrites them.

Because the runtime script is not from the official Sine store, Sine may require **Settings → Sine → Allow unsafe JavaScript** to be enabled. Enable it only for mods you trust, then restart Zen.
