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
- `--media-file ordered-media.txt` loads one media path per line (in exact order)

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
- `--media-file ordered-media.txt` loads one media path/URL per line (in exact order)

## Project builder UI (drag + one-click add)

Use the local UI if you want to drag media order and save directly:

1. Start the helper server:
   ```bash
   python3 scripts/project_helper_server.py --port 4173
   ```
2. Open `http://127.0.0.1:4173/tools/media-orderer.html`
3. Fill category/key/title/caption and path prefix
4. Choose files (or folder), drag into the order you want
5. Click `Add Project To Website`

Tips:

- To edit an existing project: pick it in `Load Existing Project`, click `Load`, then reorder/add/remove and save
- Enable `Dry run` first to verify paths and counts without writing files
- Enable `Replace existing project key` if updating an existing project
- The UI writes the selected project into `sewing.json` or `photography.json`
- Selected media is auto-sorted by capture datetime (EXIF for JPG/JPEG, fallback to file modified time), then you can drag-adjust

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
