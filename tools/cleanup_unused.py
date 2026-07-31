#!/usr/bin/env python3
"""Detecta y elimina únicamente recursos estáticos huérfanos de forma conservadora."""
from __future__ import annotations

import argparse
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAFE_ASSET_DIRS = (
    ROOT / "assets" / "photos",
    ROOT / "assets" / "img",
    ROOT / "assets" / "tools",
    ROOT / "assets" / "premium",
)
ASSET_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"}
TEXT_EXTENSIONS = {".html", ".css", ".js", ".json", ".md", ".py", ".yml", ".yaml", ".txt", ".webmanifest"}
REFERENCE_RE = re.compile(
    r"(?:src|href)=['\"]([^'\"]+)['\"]"
    r"|(?:from\s+|import\s*)['\"]([^'\"]+)['\"]"
    r"|import\s*\(\s*['\"]([^'\"]+)['\"]\s*\)"
)
SW_SHELL_RE = re.compile(r"const APP_SHELL = \[(.*?)\];", re.S)


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read_text_sources() -> dict[Path, str]:
    sources: dict[Path, str] = {}
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        if any(part in {".git", "node_modules"} for part in path.parts):
            continue
        if path.parent == ROOT / "reports" and path.name.startswith("unused-files"):
            continue
        sources[path] = path.read_text(encoding="utf-8", errors="ignore")
    for workbook in ROOT.glob("*.xlsx"):
        parts: list[str] = []
        try:
            with zipfile.ZipFile(workbook) as archive:
                for name in archive.namelist():
                    if name.endswith(".xml"):
                        parts.append(archive.read(name).decode("utf-8", errors="ignore"))
        except zipfile.BadZipFile:
            continue
        sources[workbook] = "\n".join(parts)
    return sources


def resolve_reference(source: Path, raw: str) -> Path | None:
    value = raw.split("?", 1)[0].split("#", 1)[0].strip()
    if not value or value.startswith(("http://", "https://", "data:", "#")):
        return None
    base = ROOT if source == ROOT / "index.html" or source == ROOT / "sw.js" else source.parent
    candidate = (base / value).resolve()
    return candidate if candidate == ROOT or ROOT in candidate.parents else None


def reachable_code(sources: dict[Path, str]) -> set[Path]:
    roots: set[Path] = set()
    html = sources.get(ROOT / "index.html", "")
    for groups in REFERENCE_RE.findall(html):
        for raw in filter(None, groups):
            resolved = resolve_reference(ROOT / "index.html", raw)
            if resolved:
                roots.add(resolved)
    sw = sources.get(ROOT / "sw.js", "")
    shell = SW_SHELL_RE.search(sw)
    if shell:
        for raw in re.findall(r"['\"]([^'\"]+)['\"]", shell.group(1)):
            resolved = resolve_reference(ROOT / "sw.js", raw)
            if resolved:
                roots.add(resolved)

    reachable = set(roots)
    pending = list(roots)
    while pending:
        source = pending.pop()
        text = sources.get(source, "")
        for groups in REFERENCE_RE.findall(text):
            for raw in filter(None, groups):
                resolved = resolve_reference(source, raw)
                if resolved and resolved not in reachable:
                    reachable.add(resolved)
                    pending.append(resolved)
    return reachable


def asset_candidates() -> list[Path]:
    files: list[Path] = []
    for directory in SAFE_ASSET_DIRS:
        if directory.exists():
            files.extend(path for path in directory.rglob("*") if path.is_file() and path.suffix.lower() in ASSET_EXTENSIONS)
    return sorted(set(files))


def is_asset_referenced(path: Path, corpus: str) -> bool:
    rel = relative(path)
    if rel in corpus or path.name in corpus:
        return True
    name = path.name
    family = re.sub(r"(?:\.thumb)?\.webp$", "", name, flags=re.I)
    family = re.sub(r"\.(?:png|jpe?g|avif|gif|svg)$", "", family, flags=re.I)
    return bool(family and family in corpus)


def build_report(apply: bool) -> dict[str, object]:
    sources = read_text_sources()
    reachable = reachable_code(sources)
    corpus = "\n".join(sources.values())
    candidates: list[dict[str, str]] = []

    for path in asset_candidates():
        if not is_asset_referenced(path, corpus):
            candidates.append({"path": relative(path), "reason": "recurso sin referencia en código, datos, documentación o CMS"})

    for directory, extension in ((ROOT / "modules", ".js"), (ROOT / "styles", ".css")):
        for path in sorted(directory.glob(f"*{extension}")):
            if path not in reachable:
                candidates.append({"path": relative(path), "reason": "archivo de código fuera del grafo de entrada de index.html y APP_SHELL"})

    deleted: list[str] = []
    if apply:
        for item in candidates:
            target = (ROOT / item["path"]).resolve()
            if ROOT not in target.parents or not target.is_file():
                continue
            target.unlink()
            deleted.append(item["path"])

    return {
        "ok": True,
        "mode": "apply" if apply else "report",
        "candidates": candidates,
        "deleted": deleted,
        "protectedPolicy": "Solo assets estáticos y módulos/estilos fuera del grafo; data, CMS, workflows, tools y documentación nunca se borran.",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Elimina los candidatos confirmados por la auditoría.")
    parser.add_argument("--report", type=Path, default=Path("reports/unused-files.json"))
    args = parser.parse_args()
    report = build_report(args.apply)
    output = args.report if args.report.is_absolute() else ROOT / args.report
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
