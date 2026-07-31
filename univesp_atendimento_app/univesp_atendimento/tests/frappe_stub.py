"""Stub mínimo do Frappe para testes unitários locais sem bench."""

from __future__ import annotations

import json
import types
import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock


class ValidationError(Exception):
	http_status_code = 422


class PermissionError(Exception):
	http_status_code = 403


class DoesNotExistError(Exception):
	pass


class Document:
	def __init__(self, data=None):
		if isinstance(data, dict):
			for key, value in data.items():
				setattr(self, key, value)

	def insert(self, *args, **kwargs):
		return self

	def save(self, *args, **kwargs):
		return self


def _(message):
	return message


def whitelist(*_args, **_kwargs):
	def decorator(fn):
		return fn

	return decorator


def parse_json(value, fallback=None):
	if isinstance(value, (dict, list)):
		return value
	if value in (None, ''):
		return fallback if fallback is not None else value
	try:
		return json.loads(value)
	except (TypeError, ValueError):
		return fallback if fallback is not None else value


def as_json(value):
	return json.dumps(value)


def cint(value, default=0):
	try:
		return int(value)
	except (TypeError, ValueError):
		return default


def get_request_header(name, default=None):
	return default


class _DB:
	def get_value(self, *_args, **_kwargs):
		return None

	def exists(self, *_args, **_kwargs):
		return False

	def count(self, *_args, **_kwargs):
		return 0

	def commit(self):
		return None

	def get_list(self, *_args, **_kwargs):
		return []

	def sql(self, *_args, **_kwargs):
		return []


db = _DB()


def get_doc(data=None, *_args, **_kwargs):
	if isinstance(data, dict):
		doc = SimpleNamespace(**data)
		doc.insert = MagicMock(return_value=doc)
		doc.save = MagicMock(return_value=doc)
		return doc
	return SimpleNamespace()


def throw(message, exc=ValidationError):
	raise exc(message)


def _add_to_date(date, days=0, hours=0, minutes=0, seconds=0):
	base = date if isinstance(date, datetime) else datetime.fromisoformat(str(date)[:19])
	return base + timedelta(days=days, hours=hours, minutes=minutes, seconds=seconds)


def _now_datetime():
	return datetime.now().replace(microsecond=0)


def _get_datetime(value):
	if isinstance(value, datetime):
		return value
	return datetime.fromisoformat(str(value).replace('Z', '+00:00')[:19])


def _add_days(date, days):
	return _add_to_date(date, days=days)


utils = types.SimpleNamespace(
	add_to_date=_add_to_date,
	now_datetime=_now_datetime,
	get_datetime=_get_datetime,
	add_days=_add_days,
	cint=cint,
)

file_manager = types.SimpleNamespace(
	save_file=MagicMock(return_value=SimpleNamespace(name='stub-file')),
	get_file=MagicMock(return_value=('stub-file.pdf', b'stub-content')),
)

model = types.ModuleType('frappe.model')
model.document = types.SimpleNamespace(Document=Document)

tests = types.ModuleType('frappe.tests')


class IntegrationTestCase(unittest.TestCase):
	@classmethod
	def setUpClass(cls):
		raise unittest.SkipTest('Integração Frappe indisponível neste ambiente (use bench).')


tests.IntegrationTestCase = IntegrationTestCase

__is_stub__ = True
