from __future__ import annotations

from datetime import date, datetime, timedelta

DEFAULT_WEEKLY_OFF = {5, 6}


def _parse_date(value) -> date | None:
	if isinstance(value, datetime):
		return value.date()
	if isinstance(value, date):
		return value
	text = str(value or "").strip()
	if not text:
		return None
	try:
		return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
	except ValueError:
		return None


def _normalize_calendar(calendar: dict | None) -> tuple[set[int], dict[str, dict]]:
	calendar = calendar if isinstance(calendar, dict) else {}
	weekly_off = calendar.get("weeklyOff")
	if isinstance(weekly_off, list) and weekly_off:
		weekly = {int(item) for item in weekly_off}
	else:
		weekly = set(DEFAULT_WEEKLY_OFF)
	entries = {}
	for item in calendar.get("entries") or []:
		if not isinstance(item, dict):
			continue
		key = str(item.get("date") or "").strip()
		if not key:
			continue
		entries[key] = item
	return weekly, entries


def is_weekend(day: date, calendar: dict | None = None) -> bool:
	weekly, _entries = _normalize_calendar(calendar)
	return day.weekday() in weekly


def get_calendar_entry(day: date, calendar: dict | None = None) -> dict | None:
	_entries = _normalize_calendar(calendar)[1]
	return _entries.get(day.isoformat())


def is_business_day(day: date, calendar: dict | None = None) -> bool:
	if is_weekend(day, calendar):
		return False
	return get_calendar_entry(day, calendar) is None


def add_business_days(start_at, business_days: int, calendar: dict | None = None):
	start = start_at if isinstance(start_at, datetime) else datetime.fromisoformat(str(start_at))
	cursor = start
	remaining = max(int(business_days or 0), 0)
	while remaining > 0:
		cursor += timedelta(days=1)
		if is_business_day(cursor.date(), calendar):
			remaining -= 1
	return cursor


def find_sla_level(sla_levels: list, sla_key: str) -> dict | None:
	normalized = str(sla_key or "").strip()
	if not normalized:
		return None
	for item in sla_levels or []:
		if isinstance(item, dict) and str(item.get("key") or "").strip() == normalized:
			return item
	return None


def resolve_due_at(sla_level: dict | None, start_at, calendar: dict | None = None):
	if not isinstance(sla_level, dict):
		return None
	start = start_at if isinstance(start_at, datetime) else datetime.fromisoformat(str(start_at))
	business_days = sla_level.get("businessDays")
	if business_days not in (None, "") and int(business_days) > 0:
		return add_business_days(start, int(business_days), calendar)
	hours = sla_level.get("hours")
	if hours not in (None, "") and float(hours) > 0:
		return start + timedelta(hours=float(hours))
	return None


def load_runtime_parameters() -> dict:
	import frappe

	doc = frappe.get_single("Univesp Runtime Settings")
	if not doc.parameters_json:
		return {}
	value = frappe.parse_json(doc.parameters_json)
	return value if isinstance(value, dict) else {}


def resolve_ticket_due_at(*, sla_key: str, start_at=None):
	from frappe.utils import now_datetime

	parameters = load_runtime_parameters()
	sla_level = find_sla_level(parameters.get("slaLevels") or [], sla_key)
	calendar = parameters.get("businessCalendar") if isinstance(parameters.get("businessCalendar"), dict) else {}
	start = start_at or now_datetime()
	due = resolve_due_at(sla_level, start, calendar)
	return due
