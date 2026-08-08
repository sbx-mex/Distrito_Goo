#!/usr/bin/env python3
"""Compila y valida el CMS en aislamiento; publica en el árbol solo al aprobar."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = {
    "cms-validation.json", "cms-sync.json", "event-navigation.json",
    "informative-visuals.json", "link-audit.json", "quality-gate.json",
    "compatibility.json", "experience.json", "image-optimization.json",
    "cms-change-summary.json",
    "performance-audit.json",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(stage: Path, command: list[str]) -> None:
    process = subprocess.run(command, cwd=stage, text=True, env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
    if process.returncode:
        raise RuntimeError(f"Falló: {' '.join(command)}")


def eligible(relative: Path) -> bool:
    value = relative.as_posix()
    if value.startswith("data/") and value.endswith(".json"):
        return True
    if value.startswith("reports/") and relative.name in REPORTS:
        return True
    return value.endswith((".webp", ".thumb.webp")) and value.startswith(("assets/photos/", "assets/premium/duty-roster/"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("cms", type=Path, nargs="?", default=ROOT / "Distrito_Go_CMS_v2_actualizado.xlsx")
    parser.add_argument("--project", type=Path, default=ROOT)
    parser.add_argument("--skip-mutation-test", action="store_true")
    args = parser.parse_args()
    project = args.project.resolve()
    cms = args.cms.resolve()
    if project not in cms.parents:
        raise SystemExit("El CMS debe estar dentro del proyecto para una publicación transaccional.")

    # El staging vive como hermano del proyecto para impedir que copytree se copie a sí mismo.
    with tempfile.TemporaryDirectory(prefix="distrito-go-release-", dir=project.parent) as temp:
        stage = Path(temp) / "project"
        shutil.copytree(project, stage, ignore=shutil.ignore_patterns(".git", "node_modules", "__pycache__", "playwright-report", "test-results"))
        cms_name = cms.relative_to(project).as_posix()
        py = sys.executable
        run(stage, [py, "tools/validate_cms.py", cms_name, "--report", "reports/cms-validation.json"])
        run(stage, [py, "tools/optimize_images.py", "--project", ".", "--report", "reports/image-optimization.json"])
        run(stage, [py, "tools/build_data.py", cms_name, "--project", "."])
        sync_command = [py, "tools/validate_cms_sync.py", cms_name, "--project", ".", "--report", "reports/cms-sync.json"]
        if not args.skip_mutation_test:
            sync_command.append("--mutation-test")
        run(stage, sync_command)
        run(stage, [py, "tools/validate_assets.py"])
        run(stage, [py, "tools/validate_informative_visuals.py", "--report", "reports/informative-visuals.json"])
        run(stage, [py, "tools/validate_event_navigation.py", "--report", "reports/event-navigation.json"])
        run(stage, [py, "tools/audit_links.py", cms_name, "--report", "reports/link-audit.json"])
        run(stage, [py, "tools/audit_static.py"])
        for module in sorted((stage / "modules").glob("*.js")):
            run(stage, ["node", "--check", module.relative_to(stage).as_posix()])
        run(stage, ["node", "--check", "sw.js"])
        run(stage, ["node", "tools/test_compatibility.mjs", "--report", "reports/compatibility.json"])
        run(stage, ["node", "tools/test_experience.mjs", "--report", "reports/experience.json"])
        run(stage, ["node", "tools/test_calendar_dynamic.mjs"])
        run(stage, ["node", "tools/test_event_navigation.mjs"])
        run(stage, [py, "tools/performance_audit.py", "--report", "reports/performance-audit.json"])
        run(stage, [py, "tools/quality_gate.py", "--cms", cms_name, "--report", "reports/quality-gate.json"])
        run(stage, [
            py, "tools/cms_change_summary.py", "--before", str(project / "data"),
            "--after", "data", "--source", cms_name, "--report", "reports/cms-change-summary.json",
        ])

        changed: list[str] = []
        for source in stage.rglob("*"):
            if not source.is_file():
                continue
            relative = source.relative_to(stage)
            if not eligible(relative):
                continue
            target = project / relative
            if not target.exists() or digest(source) != digest(target):
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
                changed.append(relative.as_posix())
        release = {
            "ok": True,
            "transactional": True,
            "sourceSha256": digest(cms),
            "changed": changed,
            "message": "Validación completa; la versión anterior se conservó hasta aprobar todos los controles.",
        }
        (project / "reports" / "cms-release.json").write_text(json.dumps(release, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(release, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
