#!/usr/bin/env python3
"""Valida presupuestos simples de velocidad, interfaz y navegación."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path, default=ROOT / "reports" / "performance-audit.json")
    args = parser.parse_args()
    html = text("index.html")
    css = text("styles/distrito-go.css")
    center = text("modules/operations-center.js")
    operational = text("modules/operational.js")
    search = text("modules/search.js")
    sw = text("sw.js")
    e2e = text("tools/test_navigation_e2e.mjs")
    js_bytes = sum(path.stat().st_size for path in (ROOT / "modules").glob("*.js"))

    checks = [
        {"name": "Interfaz sin telemetría redundante", "ok": all(token not in html for token in ("cms-status", "sync-status", "version-status")), "detail": "CMS, sincronización y versión fuera de la vista"},
        {"name": "Imagen inicial priorizada", "ok": "informativeVisual(item, index === 0)" in operational and "fetchpriority=\"${eager ? 'high' : 'low'}\"" in operational, "detail": "una miniatura prioritaria; el resto diferido"},
        {"name": "Búsqueda sin repintado por tecla", "ok": "requestAnimationFrame(() => input?.focus" in search and "renderTools(true);\n    if(!normalize(query))" not in search, "detail": "foco inmediato y catálogo estable"},
        {"name": "Caché rápido con datos vigentes", "ok": "staleWhileRevalidate" in sw and "isFreshData ? networkFirst" in sw, "detail": "JS/CSS instantáneos; JSON actualizado"},
        {"name": "Prueba móvil estable", "ok": "scrollIntoViewIfNeeded" in e2e and "image.decode" in e2e, "detail": "valida después de cargar la miniatura"},
        {"name": "Estado sin conexión discreto", "ok": "data-offline" in center and "command-center[data-offline]" in css, "detail": "solo aparece cuando es útil"},
        {"name": "Presupuesto CSS", "ok": len(css.encode("utf-8")) <= 200_000, "detail": f"{len(css.encode('utf-8')):,}/200,000 bytes"},
        {"name": "Presupuesto módulos JS", "ok": js_bytes <= 220_000, "detail": f"{js_bytes:,}/220,000 bytes"},
    ]
    failed = [item for item in checks if not item["ok"]]
    report = {"ok": not failed, "summary": {"passed": len(checks) - len(failed), "failed": len(failed), "total": len(checks)}, "checks": checks}
    output = args.report if args.report.is_absolute() else ROOT / args.report
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
