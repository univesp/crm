#!/usr/bin/env python3
"""Quick stats on exported subject CSV (masked)."""

from __future__ import annotations

import csv
import sys
from pathlib import Path


def mask(value: str) -> str:
    text = value.strip()
    if len(text) <= 4:
        return "***"
    return f"{text[:4]}…{text[-3:]}" if len(text) > 10 else f"{text[:3]}…"


def main() -> int:
    path = Path(sys.argv[1])
    rows = list(csv.DictReader(path.open(encoding="utf-8")))
    total = sum(int(r.get("count") or 0) for r in rows)
    print("unique:", len(rows))
    print("protocolos:", total)
    print("top_20:")
    for row in rows[:20]:
        print(f"  {int(row['count']):6d}  {mask(row['assunto'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
