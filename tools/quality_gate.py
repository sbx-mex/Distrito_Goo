#!/usr/bin/env python3
"""Puerta única de calidad para navegación, CMS, PWA, accesibilidad y limpieza."""
from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path
from typing import Any

from cleanup_unused import build_report as cleanup_report
from validate_cms import audit_cms

ROOT = Path(__file__).resolve().parents[1]


class Gate:
    def __init__(self) -> None:
        self.checks: list[dict[str, Any]] = []

    def check(self, group: str, name: str, condition: bool, detail: str, severity: str = "critical") -> None:
        self.checks.append({
            "group": group,
            "name": name,
            "ok": bool(condition),
            "severity": severity,
            "detail": detail,
        })


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def run_json(command: list[str]) -> tuple[bool, dict[str, Any]]:
    process = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, check=False)
    try:
        payload = json.loads(process.stdout)
    except json.JSONDecodeError:
        payload = {"ok": False, "errors": [process.stderr.strip() or process.stdout.strip() or "sin salida JSON"]}
    return process.returncode == 0 and bool(payload.get("ok")), payload


def relative_reference_exists(raw: str) -> bool:
    value = raw.split("?", 1)[0].split("#", 1)[0].strip()
    if not value or value in {"./", "."} or value.startswith(("http://", "https://", "data:")):
        return True
    return (ROOT / value).resolve().exists()


def inspect_project(cms: Path) -> dict[str, Any]:
    gate = Gate()
    cms_result = audit_cms(cms)
    gate.check("2 · CMS", "Estructura y calidad del CMS", cms_result["ok"], f"{cms_result['summary']['critical']} críticos; {cms_result['summary']['warnings']} advertencias")

    sync_ok, sync_result = run_json(["python", "tools/validate_cms_sync.py", str(cms), "--project", str(ROOT)])
    sync_checks = sync_result.get("checks", [])
    gate.check("2 · CMS", "Las 14 pestañas están sincronizadas", sync_ok, f"{sum(item.get('ok', False) for item in sync_checks)}/{len(sync_checks)} reconciliaciones")
    contract = load_json(ROOT / "cms-contract.json")
    gate.check("2 · CMS", "Contrato formal del CMS", set(contract.get("sheets", {})) == set(cms_result["metrics"]["sheets"]), f"{len(contract.get('sheets', {}))} pestañas definidas")

    static_ok, static_result = run_json(["python", "tools/audit_static.py"])
    assets_ok, assets_result = run_json(["python", "tools/validate_assets.py"])
    visuals_ok, visuals_result = run_json(["python", "tools/validate_informative_visuals.py", "--report", "reports/informative-visuals.json"])
    gate.check("1 · Funcional", "Rutas, IDs y destinos", static_ok, f"{len(static_result.get('errors', []))} errores")
    gate.check("1 · Funcional", "Recursos generados", assets_ok, f"{len(assets_result.get('errors', []))} rutas faltantes")
    gate.check("4 · Experiencia", "Informativos conservan sus imágenes", visuals_ok, f"{visuals_result.get('summary', {}).get('visuals', 0)} visuales; {visuals_result.get('summary', {}).get('errors', 0)} errores")

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    navigation = (ROOT / "modules" / "navigation.js").read_text(encoding="utf-8")
    search = (ROOT / "modules" / "search.js").read_text(encoding="utf-8")
    experience = (ROOT / "modules" / "experience.js").read_text(encoding="utf-8")
    operations_center = (ROOT / "modules" / "operations-center.js").read_text(encoding="utf-8")
    nav_views = re.findall(r'<button class="nav-item[^>]*data-view="([^"]+)"', html)
    gate.check("1 · Funcional", "Navegación principal estable", nav_views == ["home", "explore", "saved"], ", ".join(nav_views))
    strict_destinations = (
        "hasDestination" in search
        and "export function hasDestination" in experience
        and "section-celebrations" not in experience
        and "!partnerRecord && actionable" in search
    )
    gate.check("1 · Funcional", "Resultados de búsqueda accionables", strict_destinations, "excluye Partners, Celebraciones y tarjetas sin destino real")

    accessibility_tokens = ('lang="es-MX"', 'class="skip-link"', '<main id="main"', 'aria-live="polite"', 'aria-label="Navegación principal"')
    gate.check("4 · Experiencia", "Estructura accesible", all(token in html for token in accessibility_tokens), "idioma, salto, main, estados y navegación")
    gate.check("4 · Experiencia", "Navegación por teclado", all(token in navigation for token in ("ArrowLeft", "ArrowRight", "Home", "End")), "flechas, Inicio y Fin")
    gate.check("4 · Experiencia", "Foco y movimiento reducidos", "prefers-reduced-motion" in navigation and "focusViewTarget" in navigation, "foco al destino y desplazamiento adaptable")
    gate.check("4 · Experiencia", "Escape limpia el buscador", "event.key === 'Escape'" in search, "atajo reversible")
    gate.check("4 · Experiencia", "Centro de mando operativo", 'id="command-center"' in html and "renderOperationalCenter" in operations_center, "prioridades, avance, inventario y vencimientos")
    gate.check("4 · Experiencia", "Perfil por tienda", 'id="store-profile-select"' in html and "matchesSelectedStore" in operations_center, "preferencia local aplicada al CMS")
    gate.check("4 · Experiencia", "Agenda y progreso diario", "agenda-overview" in experience and "completionDateKey" in experience, "hoy, mañana, resto y reinicio por fecha")
    gate.check("4 · Experiencia", "Contenido temporal centralizado", "bearista-informativo" not in html and "contest-hero" not in html, "sin duplicados fuera del CMS")

    manifest = load_json(ROOT / "manifest.json")
    icons = manifest.get("icons", [])
    icon_paths_ok = bool(icons) and all(relative_reference_exists(str(icon.get("src", ""))) for icon in icons)
    gate.check("3 · PWA", "Manifest y alcance GitHub Pages", manifest.get("start_url") == "./" and manifest.get("scope") == "./", "rutas relativas a la subcarpeta")
    gate.check("3 · PWA", "Iconos PWA disponibles", icon_paths_ok, f"{len(icons)} iconos")

    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    shell_match = re.search(r"const APP_SHELL = \[(.*?)\];", sw, re.S)
    shell_refs = re.findall(r"['\"]([^'\"]+)['\"]", shell_match.group(1)) if shell_match else []
    missing_shell = [ref for ref in shell_refs if not relative_reference_exists(ref)]
    shell_bytes = sum((ROOT / ref.split("?", 1)[0].removeprefix("./")).stat().st_size for ref in shell_refs if ref not in {"./"} and relative_reference_exists(ref))
    gate.check("3 · PWA", "APP_SHELL íntegro", not missing_shell, ", ".join(missing_shell) or f"{len(shell_refs)} recursos")
    gate.check("3 · PWA", "Caché aislado por aplicación", "key.startsWith(CACHE_PREFIX)" in sw, "no elimina cachés de otros proyectos")
    gate.check("3 · PWA", "Carga inicial controlada", shell_bytes <= 1_500_000, f"{shell_bytes:,} bytes", severity="warning")

    cleanup = cleanup_report(False, "")
    gate.check("5 · Publicación", "Limpieza en modo auditoría", cleanup["ok"], f"{cleanup['summary']['candidates']} candidatos; 0 eliminados")
    workflow = (ROOT / ".github" / "workflows" / "control-calidad.yml").read_text(encoding="utf-8")
    maintenance_workflow = (ROOT / ".github" / "workflows" / "mantenimiento-seguro.yml").read_text(encoding="utf-8")
    cleanup_workflow = (ROOT / ".github" / "workflows" / "depurar-proyecto.yml").read_text(encoding="utf-8")
    browser_workflow = (ROOT / ".github" / "workflows" / "pruebas-navegacion-real.yml").read_text(encoding="utf-8")
    gate.check("5 · Publicación", "Control previo a publicar", "tools/cms_release.py" in workflow and "pull_request:" in workflow and "workflow_dispatch:" in workflow, "compilación aislada en push, PR y ejecución manual")
    safe_maintenance = all(token in maintenance_workflow for token in ("AUDITAR", "RETIRAR_EXPIRADOS", "RETIRAR_CONTENIDO_EXPIRADO", "cms_release.py"))
    safe_cleanup = all(token in cleanup_workflow for token in ("AUDITAR", "ELIMINAR", "ELIMINAR_ARCHIVOS_HUERFANOS", "cms_release.py", "git add -u"))
    gate.check("5 · Publicación", "Mantenimiento en dos fases", safe_maintenance and safe_cleanup, "contenido vencido y archivos huérfanos separados, confirmados y validados")
    gate.check("5 · Publicación", "Navegación real en navegador", all(token in browser_workflow for token in ("playwright", "320", "390", "768", "1440")), "Chromium en cuatro anchos")

    critical_failed = [item for item in gate.checks if not item["ok"] and item["severity"] == "critical"]
    warnings = [item for item in gate.checks if not item["ok"] and item["severity"] == "warning"]
    return {
        "ok": not critical_failed,
        "summary": {
            "passed": sum(item["ok"] for item in gate.checks),
            "failed": len(critical_failed),
            "warnings": len(warnings) + cms_result["summary"]["warnings"],
            "total": len(gate.checks),
        },
        "cms": cms_result,
        "cleanup": cleanup,
        "checks": gate.checks,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cms", type=Path, default=ROOT / "Distrito_Go_CMS_v2_actualizado.xlsx")
    parser.add_argument("--report", type=Path, default=ROOT / "reports" / "quality-gate.json")
    args = parser.parse_args()
    report = inspect_project(args.cms.resolve())
    output = args.report if args.report.is_absolute() else ROOT / args.report
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
