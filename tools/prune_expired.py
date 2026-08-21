#!/usr/bin/env python3
"""Retira contenido vencido de los JSON publicados sin modificar el Excel fuente."""
from __future__ import annotations

import argparse
import json
from datetime import date, datetime
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[1]
CONFIRMATION = "DEPURAR_CONTENIDO_VENCIDO"


def as_date(value: Any) -> date | None:
    text = str(value or "").strip()[:10]
    if not text:
        return None
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        return None


def expired_by(field: str, fallback: str | None = None) -> Callable[[dict[str, Any], date], bool]:
    def predicate(item: dict[str, Any], today: date) -> bool:
        end = as_date(item.get(field)) or (as_date(item.get(fallback)) if fallback else None)
        return bool(end and end < today)
    return predicate


POLICIES: dict[str, tuple[str, Callable[[dict[str, Any], date], bool]]] = {
    "eventos.v10.json": ("eventos", expired_by("Fecha Fin", "Fecha Inicio")),
    "informativo.v10.json": ("informativo", expired_by("Vigencia Fin")),
    "actividades-diarias.v10.json": ("actividadesDiarias", expired_by("Vigencia Fin")),
}


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def clean_rows(rows: list[dict[str, Any]], predicate: Callable[[dict[str, Any], date], bool], today: date) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    removed = [item for item in rows if predicate(item, today)]
    kept = [item for item in rows if not predicate(item, today)]
    return kept, removed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=date.today().isoformat(), help="Fecha de corte YYYY-MM-DD")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm", default="")
    parser.add_argument("--report", type=Path, default=Path("reports/expired-content.json"))
    args = parser.parse_args()
    today = as_date(args.date)
    if not today:
        raise SystemExit("--date debe usar el formato YYYY-MM-DD")
    if args.apply and args.confirm != CONFIRMATION:
        raise SystemExit(f"Confirmación inválida. Usa --confirm {CONFIRMATION}")

    operational_path = ROOT / "data" / "operacional.v10.json"
    operational = load(operational_path)
    removed_report: list[dict[str, Any]] = []

    for filename, (operational_key, predicate) in POLICIES.items():
        path = ROOT / "data" / filename
        rows = load(path)
        kept, removed = clean_rows(rows, predicate, today)
        removed_report.extend({
            "archivo": f"data/{filename}",
            "id": item.get("ID", ""),
            "titulo": item.get("Actividad", item.get("Nombre Evento", "")),
            "fin": item.get("Fecha Fin", item.get("Vigencia Fin", "")),
        } for item in removed)
        if args.apply and removed:
            write(path, kept)
        operational_rows = operational.get(operational_key, [])
        operational_kept, _ = clean_rows(operational_rows, predicate, today)
        operational[operational_key] = operational_kept

    if args.apply and removed_report:
        write(operational_path, operational)

    report = {
        "ok": True,
        "fechaCorte": today.isoformat(),
        "modo": "apply" if args.apply else "audit",
        "eliminados": len(removed_report),
        "detalle": removed_report,
        "nota": "El Excel permanece como fuente histórica; solo los JSON publicados se depuran.",
    }
    output = args.report if args.report.is_absolute() else ROOT / args.report
    output.parent.mkdir(parents=True, exist_ok=True)
    write(output, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
