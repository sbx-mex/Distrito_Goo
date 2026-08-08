#!/usr/bin/env python3
"""Audita y elimina recursos huérfanos con alcance cerrado y confirmación explícita."""
from __future__ import annotations

import argparse
import hashlib
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
CODE_EXTENSIONS = {".html", ".css", ".js"}
LIVE_DATA_EXTENSIONS = {".json", ".webmanifest"}
REFERENCE_RE = re.compile(
    r"(?:src|href)=['\"]([^'\"]+)['\"]"
    r"|(?:from\s+|import\s*)['\"]([^'\"]+)['\"]"
    r"|import\s*\(\s*['\"]([^'\"]+)['\"]\s*\)"
)
SW_SHELL_RE = re.compile(r"const APP_SHELL = \[(.*?)\];", re.S)
CONFIRMATION = "ELIMINAR_ARCHIVOS_HUERFANOS"
CURRENT_TESTS = {
    "test_compatibility.mjs", "test_experience.mjs", "test_calendar_dynamic.mjs",
    "test_event_navigation.mjs", "test_navigation_e2e.mjs",
}
VERSIONED_TEST_RE = re.compile(r"^test_.+_v\d+\.mjs$", re.I)
OBSOLETE_WORKFLOWS = {
    "actualizar-cms.yml",
    "control-calidad.yml",
    "depurar-proyecto.yml",
    "mantenimiento-seguro.yml",
    "pruebas-navegacion-real.yml",
    "limpieza-archivos-sin-uso.yml",
    "limpieza-contenido-expirado.yml",
    "validar-informativos-visuales.yml",
    "validar-navegacion-eventos.yml",
}
OBSOLETE_TOOLS = {"cleanup_expired.py"}


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def resolve_reference(source: Path, raw: str) -> Path | None:
    value = raw.split("?", 1)[0].split("#", 1)[0].strip()
    if not value or value.startswith(("http://", "https://", "data:", "#")):
        return None
    base = ROOT if source in {ROOT / "index.html", ROOT / "sw.js"} else source.parent
    candidate = (base / value).resolve()
    return candidate if candidate == ROOT or ROOT in candidate.parents else None


def shell_paths() -> set[Path]:
    sw_path = ROOT / "sw.js"
    match = SW_SHELL_RE.search(read_text(sw_path)) if sw_path.is_file() else None
    paths: set[Path] = set()
    if match:
        for raw in re.findall(r"['\"]([^'\"]+)['\"]", match.group(1)):
            resolved = resolve_reference(sw_path, raw)
            if resolved:
                paths.add(resolved)
    return paths


def reachable_code() -> set[Path]:
    index = ROOT / "index.html"
    reachable: set[Path] = {index}
    pending = [index]
    while pending:
        source = pending.pop()
        if not source.is_file() or source.suffix.casefold() not in CODE_EXTENSIONS:
            continue
        for groups in REFERENCE_RE.findall(read_text(source)):
            for raw in filter(None, groups):
                resolved = resolve_reference(source, raw)
                if resolved and resolved not in reachable:
                    reachable.add(resolved)
                    pending.append(resolved)
    return reachable


def live_corpus(reachable: set[Path]) -> str:
    sources = [path for path in reachable if path.is_file()]
    sources += [ROOT / "sw.js", ROOT / "manifest.json"]
    sources += sorted((ROOT / "data").glob("*.json"))
    parts = [read_text(path) for path in sources if path.is_file()]
    for workbook in ROOT.glob("*.xlsx"):
        try:
            with zipfile.ZipFile(workbook) as archive:
                parts.extend(archive.read(name).decode("utf-8", errors="ignore") for name in archive.namelist() if name.endswith(".xml"))
        except zipfile.BadZipFile:
            continue
    return "\n".join(parts)


def asset_candidates() -> list[Path]:
    return sorted({
        path
        for directory in SAFE_ASSET_DIRS if directory.exists()
        for path in directory.rglob("*")
        if path.is_file() and path.suffix.casefold() in ASSET_EXTENSIONS
    })


def reachable_tools() -> set[Path]:
    tools_dir = ROOT / "tools"
    candidates = sorted(path for path in tools_dir.iterdir() if path.is_file() and path.suffix in {".py", ".mjs"})
    external_sources = [ROOT / "package.json", ROOT / "README.md", ROOT / "BUILD.md"]
    external_sources += sorted((ROOT / ".github" / "workflows").glob("*.yml"))
    external = "\n".join(read_text(path) for path in external_sources if path.is_file())
    reachable = {path for path in candidates if path.name in external}
    pending = list(reachable)
    by_module = {path.stem: path for path in candidates if path.suffix == ".py"}
    by_name = {path.name: path for path in candidates}
    while pending:
        source = pending.pop()
        content = read_text(source)
        discovered = {path for name, path in by_name.items() if name in content}
        for module in re.findall(r"^(?:from|import)\s+([a-zA-Z_][\w.]*)", content, re.M):
            target = by_module.get(module.split(".", 1)[0])
            if target:
                discovered.add(target)
        for target in discovered - reachable:
            reachable.add(target)
            pending.append(target)
    return reachable


def asset_family(path: Path) -> str:
    name = re.sub(r"(?:\.thumb)?\.webp$", "", path.name, flags=re.I)
    return re.sub(r"\.(?:png|jpe?g|avif|gif|svg)$", "", name, flags=re.I)


def is_asset_referenced(path: Path, corpus: str) -> bool:
    return relative(path) in corpus or path.name in corpus or bool(asset_family(path) and asset_family(path) in corpus)


def build_report(apply: bool, confirmation: str) -> dict[str, object]:
    reachable = reachable_code()
    protected = shell_paths()
    corpus = live_corpus(reachable)
    candidates: list[dict[str, object]] = []

    for path in asset_candidates():
        if not is_asset_referenced(path, corpus):
            candidates.append({
                "path": relative(path),
                "reason": "sin referencia en HTML, código alcanzable, datos, manifest, Service Worker o CMS",
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            })

    for directory, extension in ((ROOT / "modules", ".js"), (ROOT / "styles", ".css")):
        for path in sorted(directory.glob(f"*{extension}")):
            if path not in reachable and path not in protected:
                candidates.append({
                    "path": relative(path),
                    "reason": "fuera del grafo de importación y no precargado por la PWA",
                    "bytes": path.stat().st_size,
                    "sha256": sha256(path),
                })

    workflow_corpus = "\n".join(read_text(path) for path in (ROOT / ".github" / "workflows").glob("*.yml"))
    workflow_corpus += read_text(ROOT / "tools" / "cms_release.py")
    workflow_corpus += read_text(ROOT / "package.json")
    for path in sorted((ROOT / "tools").glob("test_*.mjs")):
        if VERSIONED_TEST_RE.match(path.name) and path.name not in CURRENT_TESTS and path.name not in workflow_corpus:
            candidates.append({
                "path": relative(path),
                "reason": "prueba histórica sustituida y no referenciada por ningún workflow",
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            })

    reachable_tool_paths = reachable_tools()
    for path in sorted((ROOT / "tools").iterdir()):
        if path.is_file() and path.name in OBSOLETE_TOOLS:
            candidates.append({
                "path": relative(path),
                "reason": "mantenimiento temporal sustituido por cleanup_unused.py",
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            })
        elif path.is_file() and path.suffix in {".py", ".mjs"} and path not in reachable_tool_paths:
            candidates.append({
                "path": relative(path),
                "reason": "herramienta fuera del grafo de workflows, documentación, scripts y dependencias internas",
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            })

    for path in sorted((ROOT / "reports").glob("*")):
        if path.is_file():
            candidates.append({
                "path": relative(path),
                "reason": "evidencia de ejecución; se conserva como artefacto temporal de Actions, no dentro del sitio",
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            })

    for path in sorted((ROOT / ".github" / "workflows").glob("*.yml")):
        if path.name in OBSOLETE_WORKFLOWS:
            candidates.append({
                "path": relative(path),
                "reason": "workflow especializado consolidado en distrito-go.yml",
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            })

    for path in sorted((ROOT / "tools").rglob("*.pyc")):
        candidates.append({
            "path": relative(path),
            "reason": "caché compilada de Python; se regenera localmente y está excluida por .gitignore",
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        })

    candidates = list({str(item["path"]): item for item in candidates}.values())
    candidates.sort(key=lambda item: str(item["path"]))

    if apply and confirmation != CONFIRMATION:
        raise SystemExit(f"Confirmación inválida. Usa --confirm {CONFIRMATION}")

    deleted: list[str] = []
    if apply:
        for item in candidates:
            target = (ROOT / str(item["path"])).resolve()
            if ROOT in target.parents and target.is_file():
                target.unlink()
                deleted.append(str(item["path"]))

    return {
        "ok": True,
        "mode": "apply" if apply else "audit",
        "summary": {
            "candidates": len(candidates),
            "deleted": len(deleted),
            "recoverableWithGit": True,
        },
        "candidates": candidates,
        "deleted": deleted,
        "protectedPolicy": "Nunca elimina data, CMS, documentación vigente, iconos PWA ni pruebas actuales. Solo retira recursos sin referencia, pruebas versionadas sustituidas, reportes de CI y cachés regenerables.",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm", default="")
    parser.add_argument("--report", type=Path, default=Path("reports/unused-files.json"))
    args = parser.parse_args()
    report = build_report(args.apply, args.confirm)
    output = args.report if args.report.is_absolute() else ROOT / args.report
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
