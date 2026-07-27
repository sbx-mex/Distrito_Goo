#!/usr/bin/env python3
"""Comprueba que las rutas locales generadas por el CMS existan."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []


def visit(value, source: Path) -> None:
    if isinstance(value, dict):
        for child in value.values():
            visit(child, source)
        return
    if isinstance(value, list):
        for child in value:
            visit(child, source)
        return
    if not isinstance(value, str):
        return
    raw = value.split("?", 1)[0].split("#", 1)[0]
    if not raw.startswith("assets/"):
        return
    target = ROOT / unquote(raw)
    if not target.is_file():
        ERRORS.append(f"{source.relative_to(ROOT)}: falta {raw}")


for source in sorted((ROOT / "data").glob("*.json")):
    visit(json.loads(source.read_text(encoding="utf-8")), source)

print(json.dumps({"ok": not ERRORS, "errors": sorted(set(ERRORS))}, ensure_ascii=False, indent=2))
sys.exit(1 if ERRORS else 0)
