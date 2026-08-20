#!/usr/bin/env python3
"""Validate CMS-driven navigation without depending on event names or campaigns."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlparse

IMAGE_RE = re.compile(r"\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$", re.I)
ACTION_TYPES = {
    "enlace": "Enlace",
    "imagen": "Imagen",
    "informativo": "Informativo",
}
FALSE_VALUES = {"false", "falso", "no", "0", "off"}


def safe_link(value: object) -> str:
    text = str(value or "").strip()
    if not text or "..." in text or any(char in text for char in "{}<>"):
        return ""
    parsed = urlparse(text)
    return text if parsed.scheme in {"http", "https"} and bool(parsed.netloc) else ""


def local_image(project: Path, event: dict) -> tuple[str, bool]:
    for field in ("ImagenOriginal", "ImagenPath", "MiniaturaPath"):
        value = str(event.get(field) or "").strip()
        if not value or not IMAGE_RE.search(value):
            continue
        clean = value.split("?", 1)[0].split("#", 1)[0]
        candidate = (project / clean).resolve()
        try:
            candidate.relative_to(project.resolve())
        except ValueError:
            return value, False
        return value, candidate.is_file()
    return "", False


def is_published(value: object) -> bool:
    """Generated data defaults to published; explicit false values stay excluded."""
    if isinstance(value, bool):
        return value
    return str(value if value is not None else "true").strip().casefold() not in FALSE_VALUES


def action_type(event: dict) -> str:
    return ACTION_TYPES.get(str(event.get("TipoAccion") or "").strip().casefold(), "")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, default=Path("."))
    parser.add_argument("--data", type=Path, default=Path("data/eventos.v10.json"))
    parser.add_argument("--report", type=Path, default=Path("reports/event-navigation.json"))
    args = parser.parse_args()

    project = args.project.resolve()
    data_path = args.data if args.data.is_absolute() else project / args.data
    payload = json.loads(data_path.read_text(encoding="utf-8"))
    events = payload if isinstance(payload, list) else payload.get("items", payload.get("data", []))

    results = []
    missing_images = []
    invalid_links = []
    invalid_actions = []
    unpublished = 0
    for event in events:
        if not is_published(event.get("Publicar")):
            unpublished += 1
            continue
        event_id = event.get("ID")
        action = action_type(event)
        link_value = str(event.get("Link") or "").strip()
        link = safe_link(link_value)
        image, image_exists = local_image(project, event)
        if not action:
            invalid_actions.append({"id": event_id, "value": event.get("TipoAccion")})
        elif action == "Enlace" and not link:
            invalid_links.append({"id": event_id, "link": link_value})
        elif action == "Imagen" and not image_exists:
            missing_images.append({"id": event_id, "image": image})

        destination = {
            "Enlace": "link",
            "Imagen": "image",
            "Informativo": "informative",
        }.get(action, "invalid")
        results.append({
            "id": event_id,
            "title": event.get("Actividad"),
            "action": action or str(event.get("TipoAccion") or ""),
            "destination": destination,
            "hasImage": image_exists,
        })

    ok = not missing_images and not invalid_links and not invalid_actions
    report = {
        "ok": ok,
        "cmsDriven": True,
        "summary": {
            "events": len(results),
            "unpublished": unpublished,
            "links": sum(item["destination"] == "link" for item in results),
            "images": sum(item["destination"] == "image" for item in results),
            "informative": sum(item["destination"] == "informative" for item in results),
            "invalidActions": len(invalid_actions),
            "invalidLinks": len(invalid_links),
            "missingImages": len(missing_images),
        },
        "invalidActions": invalid_actions,
        "missingImages": missing_images,
        "invalidLinks": invalid_links,
        "events": results,
    }
    report_path = args.report if args.report.is_absolute() else project / args.report
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))
    if invalid_actions:
        print(f"ERROR: {len(invalid_actions)} evento(s) publicado(s) tienen TipoAccion inválido.")
    if invalid_links:
        print(f"ERROR: {len(invalid_links)} evento(s) de tipo Enlace no tienen URL completa y segura.")
    if missing_images:
        print(f"ERROR: {len(missing_images)} evento(s) de tipo Imagen no tienen un archivo existente.")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
