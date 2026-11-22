# duck

A tiny test site that can be installed as a Safari web app.

**Live:** https://codycodes.github.io/duck/

## Install it
- **Mac (Safari 17+):** open the site → **File → Add to Dock**
- **iPhone / iPad:** open in Safari → **Share → Add to Home Screen**

## Text replacements
Load a macOS/iOS text replacements `.plist` to browse and copy your shortcuts.
Export one from **System Settings → Keyboard → Text Replacements**: select entries and drag them to the Desktop.

Ways to load it:
- **Drag the file onto the open app window** (works in Safari)
- **Choose .plist…** button
- **Drop the file on the app's Dock icon:** works only when the app is installed from Chrome/Edge (File Handling API). Safari web apps don't support this yet.

XML and binary plists both work. The last loaded set is remembered in the browser.

## What's here
| File | Purpose |
| --- | --- |
| `index.html` | The page (tap the duck to quack) |
| `manifest.webmanifest` | Web app name, icons, standalone display |
| `replacements.js` | Text replacement `.plist` loading (drop, picker, Dock icon) |
| `sw.js` | Service worker for offline use |
| `icons/` | App icons (`apple-touch-icon.png` is what Safari uses) |
| `.github/workflows/pages.yml` | Deploys to GitHub Pages on every push to `main` |

## GitHub Pages setup (one time)
Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
