# Zen Sidebar Text Color Sync Fix

Changes only sidebar/tab text and icon colors when macOS switches between light and dark appearance.

## What it changes

The runtime script listens only to macOS's `(prefers-color-scheme: dark)` media query and changes the rendered sidebar/tab text and icon colors:

- light appearance: dark text/icons
- dark appearance: light text/icons

It does not modify Zen theme variables or background layers.

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

The script intentionally follows the macOS appearance query. It does not change Zen's manually selected light/dark window scheme, workspace gradient, URL bar background, workspace-button background, or any other theme variable.

Because the runtime script is not from the official Sine store, Sine may require **Settings → Sine → Allow unsafe JavaScript** to be enabled. Enable it only for mods you trust, then restart Zen.
