#!/usr/bin/env python3
"""Genera variantes WebP reproducibles para imágenes pesadas del CMS."""
from __future__ import annotations

import argparse
import io
import json
from pathlib import Path

from PIL import Image, ImageOps

PREVIEW_ONLY_NAMES = {"resumen_comunicado_semana_actual.png"}
SOURCE_SUFFIXES = {".png", ".jpg", ".jpeg"}


def should_optimize(path: Path, minimum_bytes: int) -> bool:
    return (
        path.is_file()
        and path.suffix.casefold() in SOURCE_SUFFIXES
        and path.stat().st_size >= minimum_bytes
    )


def convert(source: Path, target: Path, max_width: int | None = None) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    buffer = io.BytesIO()
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original)
        if max_width and image.width > max_width:
            height = max(1, round(image.height * (max_width / image.width)))
            image = image.resize((max_width, height), Image.Resampling.LANCZOS)
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        if source.suffix.casefold() == ".png" and max_width is None:
            image.save(buffer, "WEBP", lossless=True, method=6, exact=True)
        else:
            image.save(buffer, "WEBP", quality=88, method=6)
    target.write_bytes(buffer.getvalue())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--minimum-bytes", type=int, default=250_000)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    root = args.project.resolve()
    photos = root / "assets" / "photos"
    premium = root / "assets" / "premium" / "duty-roster"
    sources = [
        path for path in sorted(photos.glob("*"))
        if path.is_file() and path.suffix.casefold() in SOURCE_SUFFIXES
    ]
    sources.extend(
        path for path in sorted(premium.glob("*"))
        if should_optimize(path, args.minimum_bytes)
    )
    records = []
    for source in sources:
        target = source.with_suffix(".webp")
        thumbnail = source.with_name(f"{source.stem}.thumb.webp")
        preview_only = source.name.casefold() in PREVIEW_ONLY_NAMES
        convert(source, target)
        convert(source, thumbnail, max_width=720)
        optimized = source if preview_only else target
        records.append(
            {
                "source": source.relative_to(root).as_posix(),
                "optimized": optimized.relative_to(root).as_posix(),
                "thumbnail": thumbnail.relative_to(root).as_posix(),
                "sourceBytes": source.stat().st_size,
                "optimizedBytes": optimized.stat().st_size,
                "thumbnailBytes": thumbnail.stat().st_size,
                "savedBytes": source.stat().st_size - optimized.stat().st_size,
            }
        )
    report = {
        "ok": True,
        "minimumBytes": args.minimum_bytes,
        "previewOnly": sorted(PREVIEW_ONLY_NAMES),
        "images": records,
        "totalSourceBytes": sum(item["sourceBytes"] for item in records),
        "totalOptimizedBytes": sum(item["optimizedBytes"] for item in records),
        "totalThumbnailBytes": sum(item["thumbnailBytes"] for item in records),
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
