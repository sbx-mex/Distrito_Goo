#!/usr/bin/env python3
"""Validate that visible CMS informatives retain their visual preview in the UI."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGE_SUFFIXES = {".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"}


def local_path(value: object) -> Path | None:
    raw = str(value or "").split("?", 1)[0].split("#", 1)[0].strip()
    if not raw or raw.startswith(("http://", "https://")):
        return None
    candidate = (ROOT / raw.removeprefix("./")).resolve()
    return candidate if candidate == ROOT or ROOT in candidate.parents else None


def inspect() -> dict[str, object]:
    records = json.loads((ROOT / "data" / "informativo.v10.json").read_text(encoding="utf-8"))
    resources_path = ROOT / "data" / "informativo-recursos.v1.json"
    if resources_path.is_file():
        records.extend(json.loads(resources_path.read_text(encoding="utf-8")))
    visible = [item for item in records if item.get("Visible") is not False]
    errors: list[dict[str, str]] = []
    visual_count = 0
    for item in visible:
        detail = local_path(item.get("LinkDetalle"))
        if item.get("TipoRecurso") == "pdf" and (not detail or detail.suffix.casefold() != ".pdf" or not detail.is_file()):
            errors.append({"id": str(item.get("ID", "")), "actividad": str(item.get("Actividad", "")), "error": "PDF local inexistente"})
        if item.get("TipoRecurso") != "imagen":
            continue
        visual_count += 1
        candidates = [item.get("MiniaturaRecurso"), item.get("Recurso"), item.get("OriginalRecurso")]
        existing = []
        for value in candidates:
            path = local_path(value)
            if path and path.suffix.casefold() in IMAGE_SUFFIXES and path.is_file():
                existing.append(path.relative_to(ROOT).as_posix())
        if not existing:
            errors.append({"id": str(item.get("ID", "")), "actividad": str(item.get("Actividad", "")), "error": "imagen local inexistente"})

    operational = (ROOT / "modules" / "operational.js").read_text(encoding="utf-8")
    experience = (ROOT / "modules" / "experience.js").read_text(encoding="utf-8")
    css = (ROOT / "styles" / "distrito-go.css").read_text(encoding="utf-8")
    code_checks = {
        "inicioRenderizaPicture": 'class="permanent-info-media"' in operational and "informativeVisual(item, index === 0)" in operational,
        "primeraMiniaturaPrioritaria": "fetchpriority=\"${eager ? 'high' : 'low'}\"" in operational,
        "imagenIndependienteDelDestino": "const destination = Boolean(visual || externalLink)" in operational,
        "explorarPriorizaImagenCMS": "const standardCover = !hasImage && shouldUseStandardCover(item)" in experience,
        "responsiveVisual": ".permanent-info-media" in css and "object-fit:cover" in css,
    }
    for name, ok in code_checks.items():
        if not ok:
            errors.append({"id": "UI", "actividad": name, "error": "regla visual ausente"})
    return {
        "ok": not errors and visual_count > 0,
        "summary": {"visible": len(visible), "visuals": visual_count, "errors": len(errors)},
        "checks": code_checks,
        "errors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path, default=Path("reports/informative-visuals.json"))
    args = parser.parse_args()
    report = inspect()
    output = args.report if args.report.is_absolute() else ROOT / args.report
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
