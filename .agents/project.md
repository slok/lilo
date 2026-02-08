# Lilo project overview

## What this is
Lilo is a browser-only cross stitch pattern generator. It converts an uploaded image into a grid of stitches, maps it to a DMC palette, and exports a multi-page PDF pattern with icons and a legend. It also supports a Manage editor for painting individual cells and saving/loading `.lilo` project files.

## Key pieces
- `index.html`: UI markup, modals, export controls, manage editor toolbar, preview and legend layout.
- `styles.css`: UI styling, button groups, tooltip styles, modal layout, and cursor overrides.
- `app.js`: All client-side logic (image processing, palette mapping, manage editor, project save/load, PDF export trigger).
- `pdf-export.js`: PDF generation via `pdf-lib` (grid pagination, legend, arrows, page footer with signature).
- `dmc-palette.js`: DMC color list used for palette mapping.
- `manifest.json`: PWA web app manifest for installability.
- `sw.js`: Service worker providing cache-first offline support for all app and CDN assets.

## Architecture notes
- **Client-only**: No backend. Everything runs in the browser.
- **PWA**: Installable as a Progressive Web App. Service worker (`sw.js`) pre-caches all local files and CDN dependencies for full offline support. Bump `CACHE_VERSION` in `sw.js` when deploying changes.
- **Mapping pipeline**: image → resize to grid → color quantization → map to DMC palette → counts + symbols.
- **Manage editor**: pick/paint modes, right-click pick, drag painting, undo/redo history. Colors can be added from palette search only when a cell is painted.
- **Project files**: `.lilo` is a ZIP containing `project.json` + `image.png`. `project.json` includes `schemaVersion: "V1"`, `metadata` (id/createdAt/updatedAt), settings, and optional mapped data for edits.

## Important behavior
- **Hidden colors**: legend can hide colors; hidden colors are skipped in preview and PDF output.
- **PDF**: A4 pages, 70x100 tiles, top/left numbering, page number bottom-right, signature bottom-left, and center arrows (top/left only).
- **Icons**: Lucide icons are used in the UI. Noto Sans Symbols 2 is used for PDF symbol glyphs.

## External deps
- `pdf-lib` + `fontkit` for PDF generation
- `jszip` for project save/load
- `lucide` for icons
- Google Fonts (IBM Plex Mono, Noto Sans Symbols 2)
