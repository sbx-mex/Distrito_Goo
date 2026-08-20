#!/usr/bin/env python3
"""Audita URLs del CMS y detecta duplicados exactos sin alterar el Excel."""
from __future__ import annotations
import argparse
import json
import re
from collections import Counter
from pathlib import Path
from cms_pipeline import validate_workbook

URL_RE = re.compile(r'^(?:https?://|intent://)', re.I)
LOCAL_RESOURCE_RE = re.compile(r'\.(?:avif|gif|jpe?g|png|svg|webp|pdf|pptx)$', re.I)

def valid_destination(value: str, project: Path) -> tuple[bool, str]:
    if '...' in value or re.search(r'[{}<>]', value):
        return False, 'destino abreviado o con marcadores'
    if URL_RE.match(value):
        return bool(re.match(r'^(?:https?://[^/\s]+(?:/[^\s]*)?|intent://\S+)$', value, re.I)), 'URL completa'
    clean = value.split('?', 1)[0].split('#', 1)[0].strip()
    if LOCAL_RESOURCE_RE.search(clean):
        relative = Path(clean)
        if relative.is_absolute() or '..' in relative.parts:
            return False, 'ruta local insegura'
        candidates = [project / relative]
        if len(relative.parts) == 1:
            candidates.extend((project / 'assets' / folder / relative for folder in ('docs', 'photos')))
        exists = any(candidate.resolve().is_file() for candidate in candidates)
        kind = 'documento local' if relative.suffix.casefold() in {'.pdf', '.pptx'} else 'recurso gráfico local'
        return exists, kind if exists else f'{kind} inexistente'
    return False, 'no es URL completa ni recurso local permitido'

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('cms', type=Path)
    parser.add_argument('--report', type=Path, default=Path('reports/link-audit.json'))
    args = parser.parse_args()
    sheets, errors = validate_workbook(args.cms)
    links = []
    for sheet, rows in sheets.items():
        for row in rows:
            for key, value in row.items():
                if key == '__row__':
                    continue
                text = str(value or '').strip()
                if ('link' in key.casefold() or key in {'URL','WebURL','PlayStore'}) and text:
                    valid, classification = valid_destination(text, args.cms.resolve().parent)
                    links.append({'sheet': sheet, 'row': row['__row__'], 'field': key, 'value': text, 'validFormat': valid, 'classification': classification})
    counts = Counter(item['value'] for item in links if item['value'])
    report = {
        'ok': not errors and all(item['validFormat'] for item in links),
        'cms': args.cms.name,
        'linksReviewed': len(links),
        'invalidFormats': [item for item in links if not item['validFormat']],
        'repeatedValues': {key: value for key, value in counts.items() if value > 1},
        'validationErrors': errors,
        'note': 'Los enlaces repetidos se reportan; no se eliminan porque pueden ser accesos válidos definidos por el CMS.'
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report['ok'] else 1

if __name__ == '__main__':
    raise SystemExit(main())
