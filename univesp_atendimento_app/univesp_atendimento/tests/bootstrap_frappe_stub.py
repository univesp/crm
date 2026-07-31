"""Instala stub do Frappe quando o pacote real não está disponível."""

from __future__ import annotations

import sys
import types


def ensure_frappe_stub() -> bool:
	"""Retorna True se o stub foi instalado, False se Frappe real já existe."""
	try:
		import frappe  # noqa: F401

		if not getattr(frappe, '__is_stub__', False):
			return False
	except ImportError:
		pass

	from univesp_atendimento.tests import frappe_stub as stub

	frappe_module = types.ModuleType('frappe')
	for name in (
		'ValidationError',
		'PermissionError',
		'DoesNotExistError',
		'_',
		'whitelist',
		'parse_json',
		'as_json',
		'get_request_header',
		'db',
		'get_doc',
		'throw',
		'utils',
		'model',
		'tests',
		'__is_stub__',
	):
		setattr(frappe_module, name, getattr(stub, name))

	sys.modules['frappe'] = frappe_module
	sys.modules['frappe.utils'] = stub.utils
	sys.modules['frappe.utils.file_manager'] = stub.file_manager
	sys.modules['frappe.model'] = stub.model
	sys.modules['frappe.model.document'] = stub.model.document
	sys.modules['frappe.tests'] = stub.tests
	return True


def frappe_is_real() -> bool:
	try:
		import frappe

		return not getattr(frappe, '__is_stub__', False)
	except ImportError:
		return False
