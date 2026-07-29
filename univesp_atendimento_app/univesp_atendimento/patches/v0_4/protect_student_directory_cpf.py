import hashlib
import re

import frappe


def execute():
	if not frappe.db.exists("DocType", "Univesp Student Directory"):
		return
	for row in frappe.get_all(
		"Univesp Student Directory",
		fields=["name", "cpf", "cpf_hash"],
		limit_page_length=0,
	):
		cpf = re.sub(r"\D", "", str(row.cpf or ""))
		if len(cpf) != 11:
			continue
		doc = frappe.get_doc("Univesp Student Directory", row.name)
		doc.cpf = cpf
		doc.cpf_hash = hashlib.sha256(cpf.encode("utf-8")).hexdigest()
		doc.save(ignore_permissions=True)
