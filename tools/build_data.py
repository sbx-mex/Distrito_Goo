#!/usr/bin/env python3
"""Compila Distrito_Go_CMS.xlsx a JSON estático reproducible."""
from __future__ import annotations
import argparse
from pathlib import Path
from cms_pipeline import build, validate_workbook

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('cms', type=Path)
    parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    sheets, errors = validate_workbook(args.cms)
    if errors:
        print('\n'.join(f'ERROR: {item}' for item in errors))
        return 1
    changed = build(args.project.resolve(), sheets, args.cms.resolve())
    print(f'CMS compilado: {sum(map(len, sheets.values()))} registros; {len(changed)} JSON modificados')
    for path in changed:
        print(path.relative_to(args.project.resolve()).as_posix())
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
