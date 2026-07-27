#!/usr/bin/env python3
"""Pruebas reproducibles para las mejoras v22 de Distrito Goo."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from openpyxl import load_workbook
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CHECKS: list[dict[str, object]] = []


def check(name: str, condition: bool, detail: str) -> None:
    CHECKS.append({"name": name, "ok": bool(condition), "detail": detail})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path, default=ROOT / "reports" / "v22-validation.json")
    args = parser.parse_args()

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    operational = (ROOT / "modules" / "operational.js").read_text(encoding="utf-8")
    info = json.loads((ROOT / "data" / "informativo.v10.json").read_text(encoding="utf-8"))

    wb = load_workbook(ROOT / "Distrito_Go_CMS_v2_actualizado.xlsx", read_only=True, data_only=True)
    ws = wb["Informativo"]
    headers = [cell.value for cell in next(ws.iter_rows(min_row=1, max_row=1))]
    records = [dict(zip(headers, row)) for row in ws.iter_rows(min_row=2, values_only=True) if any(value not in (None, "") for value in row)]
    names = {str(row.get("Actividad", "")) for row in records}
    check("CMS visual completo", len(records) == 5, f"{len(records)} registros en Informativo")
    check(
        "Apartados CMS",
        {
            "Maquila",
            "Alineación Dress Code Portafolio",
            "Partners atentos a esta información de registro",
            "Coffee Master 2026",
            "Resumen de Comunicado Semana Actual",
        }.issubset(names),
        ", ".join(sorted(names)),
    )
    check("Resumen semanal CMS", any(row.get("Frecuencia") == "Semanal" for row in records), "Frecuencia Semanal presente")

    check("Contenedor CMS Coffee", 'id="coffee-master-grid"' in html, "Coffee Master sin ruta fija en HTML")
    check("Contenedor CMS semanal", 'id="weekly-updates-grid"' in html, "Actualizaciones sin ruta fija en HTML")
    check(
        "Sin ruta visual fija",
        "data-image-viewer=\"./assets/photos/coffemaster26.jpeg\"" not in html
        and "data-image-viewer=\"./assets/photos/resumen_comunicado_semana_actual.png\"" not in html,
        "Las rutas se reciben del JSON generado",
    )
    check("Navegación primaria compacta", len(re.findall(r'class="nav-item', html)) == 5, "5 accesos principales")
    check("Navegación agrupada", "navigation-groups" in (ROOT / "modules" / "app.js").read_text(encoding="utf-8"), "Menú Más agrupado")
    check("Carga diferida PDF", "await import('./celebration-pdf.js')" in operational, "PDF se importa al solicitarlo")
    check("Secciones diferidas", "IntersectionObserver" in operational and "data-deferred-section" in html, "Duty y Partner bajo demanda")

    shell_match = re.search(r"const APP_SHELL = \[(.*?)\];", sw, re.S)
    shell_refs = re.findall(r"['\"]([^'\"]+)['\"]", shell_match.group(1)) if shell_match else []
    shell_bytes = 0
    for ref in shell_refs:
        path = ROOT / ref.split("?", 1)[0].removeprefix("./")
        if path.is_file():
            shell_bytes += path.stat().st_size
    check("APP_SHELL esencial", shell_bytes < 2_000_000, f"{shell_bytes} bytes")
    check("Sin imágenes pesadas precargadas", not any("/photos/" in ref or "/duty-roster/" in ref for ref in shell_refs), f"{len(shell_refs)} recursos esenciales")
    check(
        "Resumen network-first",
        "resumen_comunicado_semana_actual.png" in sw and "event.respondWith(networkFirst(request))" in sw,
        "Excepción exclusiva conservada",
    )

    versioned = [item.get("Recurso", "") for item in info if item.get("TipoRecurso") == "imagen"]
    check("Rutas versionadas", all("?v=" in value for value in versioned), f"{len(versioned)} rutas con hash")
    weekly = next((item for item in info if item.get("Frecuencia") == "Semanal"), {})
    check("Nombre semanal conservado", "resumen_comunicado_semana_actual.png?v=" in weekly.get("Recurso", ""), weekly.get("Recurso", ""))

    webps = sorted((ROOT / "assets").rglob("*.webp"))
    valid_webps = 0
    for path in webps:
        try:
            with Image.open(path) as image:
                image.verify()
            valid_webps += 1
        except Exception:
            pass
    check("WebP válidos", valid_webps == len(webps) and len(webps) >= 8, f"{valid_webps}/{len(webps)} válidos")

    cms_workflow = ROOT / ".github" / "workflows" / "actualizar-cms.yml"
    cleanup_workflow = ROOT / ".github" / "workflows" / "limpieza-auditada.yml"
    check("Workflow CMS", cms_workflow.is_file(), cms_workflow.as_posix())
    check("Workflow limpieza", cleanup_workflow.is_file(), cleanup_workflow.as_posix())
    check("CMS exacto en workflow", "Distrito_Go_CMS_v2_actualizado.xlsx" in cms_workflow.read_text(encoding="utf-8"), "Nombre raíz validado")

    report = {"ok": all(item["ok"] for item in CHECKS), "checks": CHECKS}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
