#!/usr/bin/env python3
"""Apply responsive toolkit class migrations to Vue pages (UTF-8 safe)."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "univesp-frontend" / "src" / "pages"

REPLACEMENTS: tuple[tuple[str, str], ...] = (
    ('class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5"', 'class="crm-stat-grid"'),
    ('class="grid gap-3 lg:grid-cols-5"', 'class="crm-stat-grid"'),
    ('class="grid gap-3 md:grid-cols-2 xl:grid-cols-5"', 'class="crm-stat-grid"'),
    ('class="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5"', 'class="crm-stat-grid mt-3"'),
    ('class="mt-1 grid grid-cols-5 gap-1 text-center text-[10px] font-semibold text-slate-400"', 'class="crm-stat-grid mt-1 gap-1 text-center text-[10px] font-semibold text-slate-400"'),
    ('class="grid gap-4 md:grid-cols-2 xl:grid-cols-4"', 'class="crm-filter-grid--dense"'),
    ('class="grid gap-4 lg:grid-cols-[0.38fr_0.62fr]"', 'class="crm-split-grid crm-split-grid--chart gap-4"'),
    ('class="grid gap-3 rounded-[8px] border border-slate-200 bg-white/88 p-5 md:grid-cols-[minmax(0,1fr)_180px]"', 'class="crm-filter-grid rounded-[8px] border border-slate-200 bg-white/88 p-5"'),
    ('class="overflow-hidden rounded-[8px] border border-slate-200 bg-white"', 'class="crm-queue-scroll rounded-[8px] border border-slate-200 bg-white"'),
    ('class="mt-3 overflow-x-auto"', 'class="crm-table-scroll mt-3"'),
    ('class="mt-3 max-h-[260px] overflow-auto rounded-[8px] border border-slate-200"', 'class="crm-table-scroll crm-table-scroll--bounded mt-3"'),
    ('class="mt-3 max-h-[280px] overflow-auto rounded-[8px] border border-slate-200"', 'class="crm-table-scroll crm-table-scroll--bounded-lg mt-3"'),
    ('class="overflow-x-auto rounded-[8px] border border-slate-200 bg-white"', 'class="crm-table-scroll rounded-[8px] border border-slate-200 bg-white"'),
    ('class="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]"', 'class="crm-split-grid gap-6"'),
    ('class="grid gap-6 xl:grid-cols-[1fr_1fr]"', 'class="crm-split-grid gap-6"'),
    ('class="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]"', 'class="crm-split-grid gap-4"'),
    ('class="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.4fr)]"', 'class="crm-split-grid gap-4"'),
    ('class="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"', 'class="crm-split-grid gap-4"'),
    ('class="grid gap-4 px-5 py-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]"', 'class="crm-split-grid gap-4 px-5 py-5"'),
    ('class="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"', 'class="crm-split-grid gap-4"'),
    ('class="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"', 'class="crm-split-grid gap-4"'),
    ('class="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"', 'class="crm-split-grid gap-5"'),
    ('class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"', 'class="crm-split-grid gap-6"'),
    ('class="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]"', 'class="crm-split-grid gap-6"'),
    ('class="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]"', 'class="crm-split-grid gap-5"'),
    ('class="grid gap-4 border-t border-slate-200 px-4 py-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]"', 'class="crm-split-grid gap-4 border-t border-slate-200 px-4 py-4"'),
    ('class="grid gap-4 border-t border-slate-200 px-4 py-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"', 'class="crm-split-grid gap-4 border-t border-slate-200 px-4 py-4"'),
    ('class="grid gap-3 lg:grid-cols-[1fr_360px]"', 'class="crm-split-grid crm-split-grid--sidebar gap-3"'),
    ('class="grid gap-6 xl:grid-cols-[0.9fr_1.25fr_0.85fr]"', 'class="crm-split-grid crm-split-grid--triple gap-6"'),
    ('class="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"', 'class="crm-split-grid mt-5 gap-3"'),
    ('class="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"', 'class="crm-split-grid mt-4 gap-3"'),
    ('class="mt-6 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"', 'class="crm-split-grid mt-6 gap-3"'),
    ('class="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]"', 'class="crm-split-grid gap-4"'),
    ('class="grid gap-4 xl:grid-cols-[0.94fr_1.06fr]"', 'class="crm-split-grid gap-4"'),
    ('class="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]"', 'class="crm-split-grid gap-6"'),
    ('class="grid gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1.4fr_1fr_1fr]"', 'class="crm-filter-grid border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"'),
    ('class="mt-3 grid gap-3 xl:grid-cols-[1fr_390px]"', 'class="crm-split-grid crm-split-grid--sidebar mt-3 gap-3"'),
    ('class="mt-3 grid gap-3 xl:grid-cols-[0.92fr_1.08fr]"', 'class="crm-split-grid mt-3 gap-3"'),
    ('class="mt-3 grid gap-3 xl:grid-cols-[0.86fr_1.14fr]"', 'class="crm-split-grid mt-3 gap-3"'),
    ('class="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"', 'class="crm-split-grid gap-5"'),
    ('class="grid gap-3 rounded-[8px] border border-slate-200 bg-white p-4 lg:grid-cols-[1.5fr_1fr_1fr_1fr]"', 'class="crm-filter-grid--dense rounded-[8px] border border-slate-200 bg-white p-4"'),
    ('class="grid min-w-[220px] gap-2"', 'class="crm-filter-field gap-2"'),
    ('class="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.1fr)_repeat(4,minmax(0,0.7fr))]"', 'class="crm-table-scroll grid min-w-[42rem] gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.1fr)_repeat(4,minmax(0,0.7fr))]"'),
    ('class="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.6fr))]"', 'class="crm-table-scroll grid min-w-[36rem] gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.6fr))]"'),
    ('class="grid min-w-[240px] gap-2"', 'class="crm-filter-field gap-2"'),
)


def main() -> None:
    changed: list[str] = []
    for path in sorted(ROOT.rglob("*.vue")):
        text = path.read_text(encoding="utf-8")
        original = text
        for old, new in REPLACEMENTS:
            text = text.replace(old, new)
        if text != original:
            path.write_text(text, encoding="utf-8", newline="\n")
            changed.append(str(path.relative_to(ROOT.parent.parent)))

    print(f"Updated {len(changed)} files")
    for item in changed:
        print(item)


if __name__ == "__main__":
    main()
