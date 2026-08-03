#!/usr/bin/env python3
"""Validate that every published event resolves to a real, safe destination."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlparse

IMAGE_RE = re.compile(r"\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$", re.I)


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
    for event in events:
        if event.get("Publicar") is False:
            continue
        link_value = str(event.get("Link") or "").strip()
        link = safe_link(link_value)
        image, image_exists = local_image(project, event)
        if image and not image_exists:
            missing_images.append({"id": event.get("ID"), "image": image})
        if link_value and not link:
            invalid_links.append({"id": event.get("ID"), "link": link_value, "renderedAs": "informative" if not image_exists else "image"})
        destination = "link" if link else "image" if image_exists else "informative"
        results.append({"id": event.get("ID"), "title": event.get("Actividad"), "destination": destination})

    eco = next((item for item in events if "eco" in str(item.get("Actividad") or "").casefold()), None)
    eco_ok = bool(eco and safe_link(eco.get("Link")) == "https://app.slikpro.com/login/alsea")
    report = {
        "ok": not missing_images and eco_ok,
        "summary": {
            "events": len(results),
            "links": sum(item["destination"] == "link" for item in results),
            "images": sum(item["destination"] == "image" for item in results),
            "informative": sum(item["destination"] == "informative" for item in results),
            "invalidLinksSuppressed": len(invalid_links),
        },
        "ecoDirectLink": eco_ok,
        "missingImages": missing_images,
        "invalidLinksSuppressed": invalid_links,
        "events": results,
    }
    report_path = args.report if args.report.is_absolute() else project / args.report
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))
    if not eco_ok:
        print("ERROR: ECO no tiene el acceso directo esperado a Slik Pro.")
    if missing_images:
        print(f"ERROR: {len(missing_images)} referencia(s) de imagen no existen.")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
