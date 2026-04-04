# Made by Goo Website

This site is static HTML/CSS/JS. Project content is stored in `sewing.json` and `photography.json`.

## Add new projects

Use the helper instead of hand-editing large JSON files:

```bash
python3 scripts/projects.py validate
```

### Add a sewing project

If files are already in `media/sewing/<ProjectKey>/`, this auto-detects media files and types:

```bash
python3 scripts/projects.py add-sewing \
  --key HeartCoasterSet \
  --title "Heart Coaster Set" \
  --caption "Coasters for spring gifts"
```

Options:

- `--position front|back` controls where the project appears in `order` (default: `front`)
- `--replace` updates an existing project key
- `--media-dir` lets you scan a different folder
- `--media <path>` can be repeated to explicitly control file order

### Add a photography project

Use one or more `--media` values (Cloudinary URLs or local file paths):

```bash
python3 scripts/projects.py add-photography \
  --key FallMiniSession \
  --title "Fall Mini Session" \
  --caption "Golden hour session in October" \
  --media "https://res.cloudinary.com/.../image/upload/.../photo1.jpg" \
  --media "https://res.cloudinary.com/.../video/upload/.../clip1.mov"
```

Options:

- `--position front|back` controls placement in `order`
- `--replace` updates an existing key

## Validate content

Run this anytime after edits:

```bash
python3 scripts/projects.py validate
```

Validation checks:

- `order` and `projects` keys stay in sync
- every item has valid `url` + `type`
- file extensions match declared type
- local file paths exist on disk
