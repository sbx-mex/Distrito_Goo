#!/usr/bin/env python3
"""Genera variantes WebP reproducibles para imágenes pesadas del CMS."""
from __future__ import annotations

import argparse
import io
import json
from pathlib import Path

from PIL import Image, ImageOps

EXCLUDED_NAMES = {"resumen_comunicado_semana_actual.png"}
SOURCE_SUFFIXES = {".png", ".jpg", ".jpeg"}


def should_optimize(path: Path, minimum_bytes: int) -> bool:
    return (
        path.is_file()
        and path.suffix.casefold() in SOURCE_SUFFIXES
        and path.name.casefold() not in EXCLUDED_NAMES
        and path.stat().st_size >= minimum_bytes
    )


def convert(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    buffer = io.BytesIO()
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original)
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        if source.suffix.casefold() == ".png":
            image.save(buffer, "WEBP", lossless=True, method=6, exact=True)
        else:
            image.save(buffer, "WEBP", quality=86, method=6)
    target.write_bytes(buffer.getvalue())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--minimum-bytes", type=int, default=250_000)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    root = args.project.resolve()
    sources = [
        path
        for folder in (root / "assets" / "photos", root / "assets" / "premium" / "duty-roster")
        for path in sorted(folder.glob("*"))
        if should_optimize(path, args.minimum_bytes)
    ]
    records = []
    for source in sources:
        target = source.with_suffix(".webp")
        convert(source, target)
        records.append(
            {
                "source": source.relative_to(root).as_posix(),
                "optimized": target.relative_to(root).as_posix(),
                "sourceBytes": source.stat().st_size,
                "optimizedBytes": target.stat().st_size,
                "savedBytes": source.stat().st_size - target.stat().st_size,
            }
        )
    report = {
        "ok": True,
        "minimumBytes": args.minimum_bytes,
        "excluded": sorted(EXCLUDED_NAMES),
        "images": records,
        "totalSourceBytes": sum(item["sourceBytes"] for item in records),
        "totalOptimizedBytes": sum(item["optimizedBytes"] for item in records),
        "totalSavedBytes": sum(item["savedBytes"] for item in records),
    }
    text = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(text, encoding="utf-8")
    print(text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
