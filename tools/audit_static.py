#!/usr/bin/env python3
"""Auditoría estática reproducible para GitHub Pages/PWA."""
from __future__ import annotations
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []
WARNINGS: list[str] = []

for path in sorted((ROOT / "data").glob("*.json")) + [ROOT / "manifest.json"]:
    try:
        json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        ERRORS.append(f"JSON inválido {path.relative_to(ROOT)}: {exc}")

html = (ROOT / "index.html").read_text(encoding="utf-8")
ids = re.findall(r'\bid=["\']([^"\']+)', html)
for value in sorted({x for x in ids if ids.count(x) > 1}):
    ERRORS.append(f"ID HTML duplicado: {value}")

nav_views = re.findall(r'<button\b[^>]*\bdata-view=["\']([^"\']+)', html)
if nav_views != ["home", "informativo", "explore", "saved"]:
    ERRORS.append(f"Navegación principal inesperada: {nav_views!r}")
if 'data-view="search"' in html:
    ERRORS.append("La búsqueda no debe crear una opción redundante en la navegación principal")
if 'global-search-panel' not in html or 'general-search-input' not in html:
    ERRORS.append("Explorar no contiene el buscador contextual del CMS")

known_ids = set(ids)
for target in re.findall(r'\bdata-nav-target=["\']([^"\']+)', html):
    if target not in known_ids:
        ERRORS.append(f"Acción de navegación sin destino HTML: {target}")

# Sólo valida rutas estáticas literales. Las plantillas JS y las importaciones se
# resuelven por archivo para evitar falsos positivos.
def check_ref(ref: str, base: Path) -> None:
    ref = ref.split("?", 1)[0].split("#", 1)[0]
    if not ref or "${" in ref or ref.startswith(("http://", "https://", "data:", "#")):
        return
    candidate = (base / ref).resolve()
    if ROOT not in candidate.parents and candidate != ROOT:
        return
    if ref.endswith("/"):
        candidate = candidate / "index.html"
    if not candidate.exists():
        ERRORS.append(f"Ruta local inexistente: {ref} (desde {base.relative_to(ROOT) if base != ROOT else '.'})")

for ref in re.findall(r'(?:src|href)=["\']([^"\']+)["\']', html):
    check_ref(ref, ROOT)
for path in sorted((ROOT / "styles").glob("*.css")):
    for ref in re.findall(r'url\(["\']?([^"\')]+)', path.read_text(encoding="utf-8")):
        check_ref(ref, path.parent)
for path in sorted((ROOT / "modules").glob("*.js")):
    text = path.read_text(encoding="utf-8")
    for ref in re.findall(r'(?:from\s+|import\s*)["\']([^"\']+)["\']', text):
        check_ref(ref, path.parent)

navigation = (ROOT / "modules" / "navigation.js").read_text(encoding="utf-8")
application = (ROOT / "modules" / "app.js").read_text(encoding="utf-8")
if "isNavigableDestination" not in navigation or "isNavigableDestination(item.section)" not in application:
    ERRORS.append("Las acciones 'Ir a la sección' no validan su destino antes de mostrarse")

shell_match = re.search(r"const APP_SHELL = \[(.*?)\];", (ROOT / "sw.js").read_text(encoding="utf-8"), re.S)
if shell_match:
    for ref in re.findall(r"['\"]([^'\"]+)['\"]", shell_match.group(1)):
        check_ref(ref, ROOT)
else:
    ERRORS.append("No se encontró APP_SHELL en sw.js")

for path in ROOT.rglob("*"):
    if path.is_file() and path.stat().st_size == 0:
        WARNINGS.append(f"Archivo vacío: {path.relative_to(ROOT)}")


# Fase 3: la vista principal no debe recuperar recursos o eventos exclusivos del perfil.
for forbidden in (
    'assets/photos/kike-dm.jpeg', 'dm-contact', 'dm-photo', 'dm-profile-strip',
    'emergencyContact', 'identity?.coach',
):
    for path in [ROOT / 'index.html', ROOT / 'sw.js', ROOT / 'modules' / 'app.js', ROOT / 'data' / 'config.v10.json']:
        if path.exists() and forbidden in path.read_text(encoding='utf-8'):
            ERRORS.append(f'Referencia obsoleta de District Coach en {path.relative_to(ROOT)}: {forbidden}')

print(json.dumps({"ok": not ERRORS, "errors": ERRORS, "warnings": WARNINGS}, ensure_ascii=False, indent=2))
sys.exit(1 if ERRORS else 0)
