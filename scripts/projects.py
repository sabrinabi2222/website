#!/usr/bin/env python3
"""Helpers for adding and validating portfolio projects."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
SEWING_JSON = ROOT / "sewing.json"
PHOTOGRAPHY_JSON = ROOT / "photography.json"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".heic", ".heif"}
VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".webm"}


@dataclass
class MediaItem:
    url: str
    type: str


class ProjectError(RuntimeError):
    pass


def infer_type(source: str) -> str:
    path = urlparse(source).path if source.startswith(("http://", "https://")) else source
    ext = Path(path).suffix.lower()
    if ext in IMAGE_EXTS:
        return "image"
    if ext in VIDEO_EXTS:
        return "video"
    raise ProjectError(f"Unsupported media extension for '{source}'")


def normalize_local_path(path_text: str) -> str:
    source = Path(path_text)
    candidate = source if source.is_absolute() else (ROOT / source)
    if not candidate.exists() or not candidate.is_file():
        raise ProjectError(f"Local media file not found: {path_text}")
    rel = candidate.relative_to(ROOT)
    return rel.as_posix()


def gather_from_dir(media_dir: str) -> list[MediaItem]:
    target = Path(media_dir)
    dir_path = target if target.is_absolute() else (ROOT / target)

    if not dir_path.exists() or not dir_path.is_dir():
        raise ProjectError(f"Directory not found: {media_dir}")

    entries = sorted([p for p in dir_path.iterdir() if p.is_file()], key=lambda p: p.name.lower())
    if not entries:
        raise ProjectError(f"No files found in directory: {media_dir}")

    items: list[MediaItem] = []
    for file_path in entries:
        rel = file_path.relative_to(ROOT).as_posix()
        items.append(MediaItem(url=rel, type=infer_type(rel)))
    return items


def gather_explicit(media_values: Iterable[str]) -> list[MediaItem]:
    values = [v.strip() for v in media_values if v and v.strip()]
    if not values:
        raise ProjectError("No media provided")

    items: list[MediaItem] = []
    for source in values:
        url = source if source.startswith(("http://", "https://")) else normalize_local_path(source)
        items.append(MediaItem(url=url, type=infer_type(url)))
    return items


def resolve_path(path_text: str) -> Path:
    candidate = Path(path_text)
    if candidate.is_absolute():
        return candidate

    cwd_candidate = (Path.cwd() / candidate).resolve()
    if cwd_candidate.exists():
        return cwd_candidate

    return (ROOT / candidate).resolve()


def read_media_file(path_text: str) -> list[str]:
    file_path = resolve_path(path_text)
    if not file_path.exists() or not file_path.is_file():
        raise ProjectError(f"Media list file not found: {path_text}")

    values: list[str] = []
    for raw in file_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        values.append(line)

    if not values:
        raise ProjectError(f"Media list file is empty: {path_text}")

    return values


def load_dataset(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, dict):
        raise ProjectError(f"Invalid JSON object in {path.name}")

    data.setdefault("projects", {})
    data.setdefault("order", [])

    if not isinstance(data["projects"], dict):
        raise ProjectError(f"'projects' must be an object in {path.name}")
    if not isinstance(data["order"], list):
        raise ProjectError(f"'order' must be a list in {path.name}")

    return data


def save_dataset(path: Path, data: dict) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def upsert_project(
    *,
    json_path: Path,
    key: str,
    title: str,
    caption: str,
    items: list[MediaItem],
    position: str,
    replace: bool,
) -> None:
    data = load_dataset(json_path)
    projects = data["projects"]
    order = data["order"]

    if key in projects and not replace:
        raise ProjectError(f"Project '{key}' already exists in {json_path.name}. Use --replace to update it.")

    projects[key] = {
        "items": [{"url": item.url, "type": item.type} for item in items],
        "title": title,
        "caption": caption,
    }

    if key in order:
        order.remove(key)
    if position == "front":
        order.insert(0, key)
    else:
        order.append(key)

    save_dataset(json_path, data)


def validate_dataset(path: Path) -> list[str]:
    errors: list[str] = []
    data = load_dataset(path)
    projects = data["projects"]
    order = data["order"]

    missing_order = [k for k in projects if k not in order]
    unknown_in_order = [k for k in order if k not in projects]
    if missing_order:
        errors.append(f"{path.name}: project keys missing from order: {', '.join(missing_order)}")
    if unknown_in_order:
        errors.append(f"{path.name}: order keys not in projects: {', '.join(unknown_in_order)}")

    for key, meta in projects.items():
        if not isinstance(meta, dict):
            errors.append(f"{path.name}:{key}: project must be an object")
            continue

        items = meta.get("items")
        if not isinstance(items, list) or not items:
            errors.append(f"{path.name}:{key}: items must be a non-empty array")
            continue

        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                errors.append(f"{path.name}:{key}: items[{idx}] must be an object")
                continue

            url = item.get("url")
            item_type = item.get("type")
            if not isinstance(url, str) or not url:
                errors.append(f"{path.name}:{key}: items[{idx}].url must be a non-empty string")
                continue
            if item_type not in {"image", "video"}:
                errors.append(f"{path.name}:{key}: items[{idx}].type must be 'image' or 'video'")
                continue

            try:
                inferred = infer_type(url)
                if inferred != item_type:
                    errors.append(
                        f"{path.name}:{key}: items[{idx}] type mismatch (declared={item_type}, inferred={inferred})"
                    )
            except ProjectError as exc:
                errors.append(f"{path.name}:{key}: items[{idx}] {exc}")
                continue

            is_local = not url.startswith(("http://", "https://"))
            if is_local:
                local_path = ROOT / url
                if not local_path.exists():
                    errors.append(f"{path.name}:{key}: items[{idx}] missing local file '{url}'")

    return errors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Add and validate portfolio projects")
    sub = parser.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--key", required=True, help="JSON project key")
    common.add_argument("--title", required=True, help="Display title")
    common.add_argument("--caption", required=True, help="Project caption")
    common.add_argument(
        "--position",
        choices=["front", "back"],
        default="front",
        help="Where to place the project key in order[]",
    )
    common.add_argument("--replace", action="store_true", help="Replace an existing project key")

    sewing = sub.add_parser("add-sewing", parents=[common], help="Add/update a sewing project")
    sewing.add_argument(
        "--media-dir",
        help="Directory with media files (defaults to media/sewing/<key>)",
    )
    sewing.add_argument(
        "--media",
        action="append",
        default=[],
        help="Explicit media file path (repeatable); skips --media-dir auto-scan",
    )
    sewing.add_argument(
        "--media-file",
        help="Text file with one media path/URL per line (supports comments with #)",
    )

    photo = sub.add_parser("add-photography", parents=[common], help="Add/update a photography project")
    photo.add_argument(
        "--media",
        action="append",
        default=[],
        help="Media URL/path (repeatable; supports Cloudinary URLs or local files)",
    )
    photo.add_argument(
        "--media-file",
        help="Text file with one media path/URL per line (supports comments with #)",
    )

    sub.add_parser("validate", help="Validate sewing.json and photography.json")
    return parser.parse_args()


def run() -> int:
    args = parse_args()

    try:
        if args.command == "add-sewing":
            if args.media and args.media_file:
                raise ProjectError("Use either --media or --media-file, not both")

            if args.media:
                items = gather_explicit(args.media)
            elif args.media_file:
                items = gather_explicit(read_media_file(args.media_file))
            else:
                media_dir = args.media_dir or f"media/sewing/{args.key}"
                items = gather_from_dir(media_dir)

            upsert_project(
                json_path=SEWING_JSON,
                key=args.key,
                title=args.title,
                caption=args.caption,
                items=items,
                position=args.position,
                replace=args.replace,
            )
            print(f"Updated {SEWING_JSON.name} with project '{args.key}' ({len(items)} items)")
            return 0

        if args.command == "add-photography":
            if args.media and args.media_file:
                raise ProjectError("Use either --media or --media-file, not both")

            media_values = args.media or (read_media_file(args.media_file) if args.media_file else [])
            items = gather_explicit(media_values)
            upsert_project(
                json_path=PHOTOGRAPHY_JSON,
                key=args.key,
                title=args.title,
                caption=args.caption,
                items=items,
                position=args.position,
                replace=args.replace,
            )
            print(f"Updated {PHOTOGRAPHY_JSON.name} with project '{args.key}' ({len(items)} items)")
            return 0

        if args.command == "validate":
            errors = [*validate_dataset(SEWING_JSON), *validate_dataset(PHOTOGRAPHY_JSON)]
            if errors:
                print("Validation failed:")
                for err in errors:
                    print(f"- {err}")
                return 1

            print("Validation passed for sewing.json and photography.json")
            return 0

    except ProjectError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    return 1


if __name__ == "__main__":
    raise SystemExit(run())
