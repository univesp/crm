from datetime import datetime
from unittest import TestCase

from univesp_atendimento.business_due import add_business_days, is_business_day, resolve_due_at


class TestBusinessDue(TestCase):
	def test_weekend_is_not_business_day(self):
		saturday = datetime(2026, 1, 3).date()
		self.assertFalse(is_business_day(saturday))

	def test_holiday_is_not_business_day(self):
		holiday = datetime(2026, 1, 1).date()
		calendar = {
			"weeklyOff": [5, 6],
			"entries": [{"date": "2026-01-01", "type": "holiday", "label": "Ano novo"}],
		}
		self.assertFalse(is_business_day(holiday, calendar))

	def test_add_business_days_skips_weekend_and_holiday(self):
		start = datetime(2025, 12, 31, 9, 0, 0)
		calendar = {
			"weeklyOff": [5, 6],
			"entries": [
				{"date": "2026-01-01", "type": "holiday", "label": "Ano novo"},
				{"date": "2026-01-02", "type": "bridge", "label": "Ponte"},
			],
		}
		due = add_business_days(start, 1, calendar)
		self.assertEqual(due.date().isoformat(), "2026-01-05")

	def test_resolve_due_at_uses_hours_for_short_sla(self):
		due = resolve_due_at({"hours": 4}, datetime(2026, 1, 5, 10, 0, 0))
		self.assertEqual(due, datetime(2026, 1, 5, 14, 0, 0))

	def test_resolve_due_at_uses_business_days_for_long_sla(self):
		calendar = {"weeklyOff": [5, 6], "entries": []}
		due = resolve_due_at(
			{"businessDays": 2},
			datetime(2026, 1, 5, 10, 0, 0),
			calendar,
		)
		self.assertEqual(due.date().isoformat(), "2026-01-07")
