#!/usr/bin/env python3
"""Resume cambios operativos entre la publicación vigente y el CMS recién compilado."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def stable_key(item: Any, index: int) -> str:
    if not isinstance(item, dict):
        return f"#{index}:{hashlib.sha256(json.dumps(item, sort_keys=True).encode()).hexdigest()[:12]}"
    for field in ("ID", "id", "Identificador", "SBX", "Nombre", "nombre"):
        value = str(item.get(field, "")).strip()
        if value:
            return f"{field}:{value}"
    composite = "|".join(str(item.get(field, "")).strip() for field in ("Día", "Estación", "Orden"))
    return composite if composite.strip("|") else f"#{index}"


def rows(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, dict) and isinstance(value.get("eventos"), list):
        return value["eventos"]
    return []


def summarize(before_dir: Path, after_dir: Path, source: Path) -> dict[str, Any]:
    changes = []
    names = sorted({path.name for path in before_dir.glob("*.json")} | {path.name for path in after_dir.glob("*.json")})
    for name in names:
        before_path, after_path = before_dir / name, after_dir / name
        if not after_path.is_file():
            continue
        before_value = load(before_path) if before_path.is_file() else []
        after_value = load(after_path)
        before_rows = {stable_key(item, index): item for index, item in enumerate(rows(before_value))}
        after_rows = {stable_key(item, index): item for index, item in enumerate(rows(after_value))}
        if not before_rows and not after_rows:
            if before_value != after_value:
                changes.append({"file": name, "type": "metadata", "changed": True})
            continue
        added = sorted(after_rows.keys() - before_rows.keys())
        removed = sorted(before_rows.keys() - after_rows.keys())
        modified = sorted(key for key in before_rows.keys() & after_rows.keys() if before_rows[key] != after_rows[key])
        if added or removed or modified:
            changes.append({
                "file": name,
                "before": len(before_rows),
                "after": len(after_rows),
                "added": added,
                "removed": removed,
                "modified": modified,
            })
    return {
        "ok": True,
        "source": source.name,
        "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "filesChanged": len(changes),
        "totals": {
            "added": sum(len(item.get("added", [])) for item in changes),
            "removed": sum(len(item.get("removed", [])) for item in changes),
            "modified": sum(len(item.get("modified", [])) for item in changes),
        },
        "changes": changes,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--before", type=Path, required=True)
    parser.add_argument("--after", type=Path, required=True)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    report = summarize(args.before.resolve(), args.after.resolve(), args.source.resolve())
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
