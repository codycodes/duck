# duck

A tiny test site that can be installed as a Safari web app.

**Live:** https://codycodes.github.io/duck/

## Install it
- **Mac (Safari 17+):** open the site → **File → Add to Dock**
- **iPhone / iPad:** open in Safari → **Share → Add to Home Screen**

## What's here
| File | Purpose |
| --- | --- |
| `index.html` | The page (tap the duck to quack) |
| `manifest.webmanifest` | Web app name, icons, standalone display |
| `sw.js` | Service worker for offline use |
| `icons/` | App icons (`apple-touch-icon.png` is what Safari uses) |
| `.github/workflows/pages.yml` | Deploys to GitHub Pages on every push to `main` |

## GitHub Pages setup (one time)
Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
