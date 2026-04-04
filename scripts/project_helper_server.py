#!/usr/bin/env python3
"""Local helper server for media ordering + one-click project creation."""

from __future__ import annotations

import argparse
import json
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from projects import (
    PHOTOGRAPHY_JSON,
    SEWING_JSON,
    ProjectError,
    gather_explicit,
    upsert_project,
    validate_dataset,
)

ROOT = Path(__file__).resolve().parent.parent


class ProjectHelperHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=directory or str(ROOT), **kwargs)

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _dataset_path_for_category(self, category: str) -> Path:
        if category == "sewing":
            return SEWING_JSON
        if category == "photography":
            return PHOTOGRAPHY_JSON
        raise ProjectError("Category must be 'sewing' or 'photography'")

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/list-projects":
            try:
                params = parse_qs(parsed.query)
                category = (params.get("category", [""])[0] or "").strip()
                dataset_path = self._dataset_path_for_category(category)
                data = json.loads(dataset_path.read_text(encoding="utf-8"))
                projects = data.get("projects", {})
                order = data.get("order", [])
                listing = [
                    {
                        "key": key,
                        "title": (projects.get(key) or {}).get("title", key),
                    }
                    for key in order
                    if key in projects
                ]
                self._send_json(HTTPStatus.OK, {"ok": True, "projects": listing})
            except ProjectError as exc:
                self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})
            except Exception as exc:  # noqa: BLE001
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": f"Unexpected error: {exc}"})
            return

        if parsed.path == "/api/get-project":
            try:
                params = parse_qs(parsed.query)
                category = (params.get("category", [""])[0] or "").strip()
                key = (params.get("key", [""])[0] or "").strip()
                dataset_path = self._dataset_path_for_category(category)
                data = json.loads(dataset_path.read_text(encoding="utf-8"))
                projects = data.get("projects", {})
                order = data.get("order", [])
                if key not in projects:
                    raise ProjectError(f"Project '{key}' not found")

                meta = projects[key]
                position = "front" if order and order[0] == key else "back"
                self._send_json(
                    HTTPStatus.OK,
                    {
                        "ok": True,
                        "project": {
                            "key": key,
                            "title": meta.get("title", key),
                            "caption": meta.get("caption", ""),
                            "position": position,
                            "items": meta.get("items", []),
                        },
                    },
                )
            except ProjectError as exc:
                self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})
            except Exception as exc:  # noqa: BLE001
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": f"Unexpected error: {exc}"})
            return

        super().do_GET()

    def do_POST(self) -> None:
        if self.path != "/api/add-project":
            self._send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))

            category = payload.get("category")
            key = (payload.get("key") or "").strip()
            title = (payload.get("title") or "").strip()
            caption = (payload.get("caption") or "").strip()
            position_mode = (payload.get("position_mode") or payload.get("position") or "front").strip()
            position_key = (payload.get("position_key") or "").strip() or None
            replace = bool(payload.get("replace"))
            dry_run = bool(payload.get("dry_run"))
            media = payload.get("media") or []

            if category not in {"sewing", "photography"}:
                raise ProjectError("Category must be 'sewing' or 'photography'")
            if not key:
                raise ProjectError("Project key is required")
            if not title:
                raise ProjectError("Project title is required")
            if not caption:
                raise ProjectError("Project caption is required")
            if position_mode not in {"front", "back", "before", "after", "keep"}:
                raise ProjectError("Position mode must be front, back, before, after, or keep")
            if not isinstance(media, list) or not media:
                raise ProjectError("At least one media path/URL is required")

            items = gather_explicit(media)

            if dry_run:
                image_count = sum(1 for i in items if i.type == "image")
                video_count = sum(1 for i in items if i.type == "video")
                self._send_json(
                    HTTPStatus.OK,
                    {
                        "ok": True,
                        "dry_run": True,
                        "project": key,
                        "count": len(items),
                        "images": image_count,
                        "videos": video_count,
                    },
                )
                return

            json_path = SEWING_JSON if category == "sewing" else PHOTOGRAPHY_JSON
            upsert_project(
                json_path=json_path,
                key=key,
                title=title,
                caption=caption,
                items=items,
                position_mode=position_mode,
                position_key=position_key,
                replace=replace,
            )

            errors = validate_dataset(json_path)
            if errors:
                raise ProjectError("Validation failed after update: " + "; ".join(errors))

            self._send_json(
                HTTPStatus.OK,
                {
                    "ok": True,
                    "dry_run": False,
                    "project": key,
                    "updated": json_path.name,
                    "count": len(items),
                },
            )
        except json.JSONDecodeError:
            self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Invalid JSON body"})
        except ProjectError as exc:
            self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})
        except Exception as exc:  # noqa: BLE001
            self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": f"Unexpected error: {exc}"})


def main() -> int:
    parser = argparse.ArgumentParser(description="Run local helper server for project ordering/addition")
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args()

    handler_cls = partial(ProjectHelperHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler_cls)
    print(f"Serving on http://127.0.0.1:{args.port}")
    print("Open http://127.0.0.1:{port}/tools/media-orderer.html".format(port=args.port))

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
