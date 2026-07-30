import frappe
from frappe.utils import get_assets_json


def refresh_assets_json_cache():
	"""Regenerate the shared assets manifest from disk and repopulate client cache."""
	frappe.client_cache.delete_value("assets_json", shared=True)
	return frappe._dict(get_assets_json())
