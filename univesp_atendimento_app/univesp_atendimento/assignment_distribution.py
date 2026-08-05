"""Server-side resolution of the first owner for an area case.

This module intentionally keeps visibility and assignment separate. Visibility
is enforced by the ticket scope; this service only decides who receives a new
case after routing has resolved its area.
"""

import frappe
from frappe.utils import get_datetime, now_datetime


ACTIVE_STATUSES = {"open", "in_analysis", "waiting_student", "waiting_internal"}
UNAVAILABLE = "unavailable"
REDUCED_CAPACITY = "reduced_capacity"


def resolve_area_assignment(
	*,
	area: str,
	theme_key: str = "",
	subsubject_key: str = "",
	current_date=None,
) -> dict:
	area = str(area or "").strip()
	now = current_date or now_datetime()
	if not area:
		return _unassigned("no_area", "Caso sem área resolvida.")

	members = _area_members(area)
	rule = _matching_rule(area, theme_key, subsubject_key)
	requested_mode = str((rule or {}).get("distributionMode") or "automatic").strip()
	if requested_mode not in {"automatic", "restricted"}:
		requested_mode = "automatic"

	availability = _availability_by_profile(area, members, now)
	workload = _workload_by_email(area, now)
	if requested_mode == "restricted":
		candidate_ids = _rule_profile_ids(rule, members, "distributionUsers", "eligibleUsers")
		pool = [members[profile_id] for profile_id in candidate_ids if profile_id in members]
		selected = _choose(pool, availability, workload)
		if not selected:
			return _unassigned(
				"restricted_no_eligible",
				"A regra restrita não possui pessoa apta no período atual.",
				area=area,
				rule=rule,
				mode="restricted",
				members=pool,
				availability=availability,
			)
		return _assigned(
			selected,
			area=area,
			rule=rule,
			mode="restricted",
			members=pool,
			availability=availability,
		)

	analysts = [member for member in members.values() if member["profile_key"] == "analista_area"]
	selected = _choose(analysts, availability, workload)
	resolution_mode = "automatic"
	pool = analysts
	if not selected:
		managers = [member for member in members.values() if member["profile_key"] == "gestor_area"]
		selected = _choose(managers, availability, workload)
		resolution_mode = "automatic_manager_fallback"
		pool = managers
	if not selected:
		return _unassigned(
			"automatic_no_eligible",
			"Não há analista ou gestor elegível para receber o caso.",
			area=area,
			rule=rule,
			mode=resolution_mode,
			members=pool,
			availability=availability,
		)
	return _assigned(
		selected,
		area=area,
		rule=rule,
		mode=resolution_mode,
		members=pool,
		availability=availability,
	)


def _area_members(area):
	rows = frappe.get_all(
		"Univesp Access Profile",
		filters={"active": 1, "profile_key": ["in", ["analista_area", "gestor_area"]]},
		fields=["name", "user_email", "display_name", "profile_key", "scopes_json"],
		page_length=500,
	)
	members = {}
	for row in rows:
		scopes = frappe.parse_json(row.get("scopes_json") or "{}")
		if area not in (scopes.get("areas") or []):
			continue
		profile_id = str(row.get("name") or "").strip()
		if not profile_id:
			continue
		members[profile_id] = {
			"profile_id": profile_id,
			"email": str(row.get("user_email") or "").strip().lower(),
			"display_name": str(row.get("display_name") or row.get("user_email") or profile_id).strip(),
			"profile_key": str(row.get("profile_key") or "").strip(),
		}
	return members


def _matching_rule(area, theme_key, subsubject_key):
	name = frappe.db.exists("Univesp Area Governance", {"area_label": area})
	if not name:
		return None
	doc = frappe.get_doc("Univesp Area Governance", name)
	rules = _json_list(doc.rules_json)
	theme = _norm(theme_key)
	subsubject = _norm(subsubject_key)
	active = [rule for rule in rules if isinstance(rule, dict) and rule.get("isActive", True) is not False]
	for rule in active:
		if _norm(rule.get("themeKey") or rule.get("subjectCode")) == theme and _norm(
			rule.get("subsubjectKey") or rule.get("subsubjectCode")
		) == subsubject:
			return rule
	for rule in active:
		if _norm(rule.get("themeKey") or rule.get("subjectCode")) == theme and not _norm(
			rule.get("subsubjectKey") or rule.get("subsubjectCode")
		):
			return rule
	return None


def _rule_profile_ids(rule, members, primary_field, legacy_field):
	if not isinstance(rule, dict):
		return []
	values = rule.get(primary_field)
	if values is None:
		values = rule.get(legacy_field) or []
	ids = []
	for value in values:
		candidate = str(value or "").strip()
		if candidate in members and candidate not in ids:
			ids.append(candidate)
			continue
		matches = [
			profile_id
			for profile_id, member in members.items()
			if _norm(candidate) in {_norm(member["email"]), _norm(member["display_name"])}
		]
		if len(matches) == 1 and matches[0] not in ids:
			ids.append(matches[0])
	return ids


def _availability_by_profile(area, members, now):
	name = frappe.db.exists("Univesp Area Governance", {"area_label": area})
	rows = []
	if name:
		doc = frappe.get_doc("Univesp Area Governance", name)
		rows = _json_list(doc.availability_json)
	result = {}
	for profile_id, member in members.items():
		matching = []
		for record in rows:
			if not isinstance(record, dict):
				continue
			user_id = str(record.get("userId") or "").strip()
			user_name = _norm(record.get("userName"))
			if user_id and user_id != profile_id and user_id != member["email"]:
				continue
			if not user_id and user_name not in {_norm(member["display_name"]), _norm(member["email"])}:
				continue
			record_area = _norm(record.get("areaLabel"))
			if record_area and record_area != _norm(area):
				continue
			if _is_active_window(record, now):
				matching.append(record)
		matching.sort(key=lambda item: (_availability_priority(item), _area_specificity(item, area)), reverse=True)
		selected = matching[0] if matching else {}
		status = str(selected.get("statusCode") or "available").strip()
		raw_capacity = selected.get("capacityFactor")
		capacity = float(raw_capacity) if raw_capacity is not None else (0 if status == UNAVAILABLE else 1)
		result[profile_id] = {"status": status, "capacity_factor": max(capacity, 0)}
	return result


def _workload_by_email(area, now):
	rows = frappe.get_all(
		"HD Ticket",
		filters={
			"custom_univesp_area": area,
			"custom_univesp_status_code": ["in", sorted(ACTIVE_STATUSES)],
		},
		fields=["custom_univesp_assignee_email", "custom_univesp_due_at"],
		page_length=0,
	)
	workload = {}
	for row in rows:
		email = str(row.get("custom_univesp_assignee_email") or "").strip().lower()
		if not email:
			continue
		current = workload.setdefault(email, {"active_cases": 0, "risk_cases": 0, "overdue_cases": 0})
		current["active_cases"] += 1
		due_at = row.get("custom_univesp_due_at")
		if not due_at:
			continue
		try:
			due = get_datetime(due_at)
		except (TypeError, ValueError):
			continue
		if due <= now:
			current["overdue_cases"] += 1
		elif (due - now).total_seconds() <= 2 * 60 * 60:
			current["risk_cases"] += 1
	return workload


def _choose(pool, availability, workload):
	candidates = []
	for member in pool:
		availability_row = availability.get(member["profile_id"], {"status": "available", "capacity_factor": 1})
		if availability_row["status"] == UNAVAILABLE:
			continue
		load = workload.get(member["email"], {"active_cases": 0, "risk_cases": 0, "overdue_cases": 0})
		factor = availability_row["capacity_factor"]
		if factor <= 0:
			continue
		score = (
			load["active_cases"] + load["risk_cases"] * 1.5 + load["overdue_cases"] * 2
		) / factor
		candidates.append({"member": member, "score": score, "load": load, "capacity_factor": factor})
	candidates.sort(key=lambda row: (row["score"], row["member"]["profile_id"]))
	return candidates[0] if candidates else None


def _assigned(selected, *, area, rule, mode, members, availability):
	member = selected["member"]
	return {
		"status": "assigned",
		"distribution_mode": str((rule or {}).get("distributionMode") or "automatic"),
		"resolution_mode": mode,
		"rule_id": str((rule or {}).get("id") or ""),
		"area": area,
		"profile_id": member["profile_id"],
		"assignee_email": member["email"],
		"assignee_name": member["display_name"],
		"reason": "Menor carga ponderada entre as pessoas elegíveis.",
		"candidate_profile_ids": [item["profile_id"] for item in members],
		"unavailable_profile_ids": [
			item["profile_id"]
			for item in members
			if availability.get(item["profile_id"], {}).get("status") == UNAVAILABLE
		],
		"score": round(selected["score"], 2),
		"active_cases": selected["load"]["active_cases"],
		"risk_cases": selected["load"]["risk_cases"],
		"overdue_cases": selected["load"]["overdue_cases"],
		"capacity_factor": selected["capacity_factor"],
	}


def _unassigned(reason_code, reason, *, area="", rule=None, mode="fallback_unassigned", members=None, availability=None):
	members = members or []
	availability = availability or {}
	return {
		"status": "unassigned_exception",
		"distribution_mode": str((rule or {}).get("distributionMode") or "automatic"),
		"resolution_mode": mode,
		"rule_id": str((rule or {}).get("id") or ""),
		"area": area,
		"profile_id": "",
		"assignee_email": "",
		"assignee_name": "",
		"reason_code": reason_code,
		"reason": reason,
		"candidate_profile_ids": [item["profile_id"] for item in members],
		"unavailable_profile_ids": [
			item["profile_id"]
			for item in members
			if availability.get(item["profile_id"], {}).get("status") == UNAVAILABLE
		],
	}


def _is_active_window(record, now):
	try:
		starts = get_datetime(record.get("startsAt")) if record.get("startsAt") else None
		ends = get_datetime(record.get("endsAt")) if record.get("endsAt") else None
		return (starts is None or now >= starts) and (ends is None or now <= ends)
	except (TypeError, ValueError):
		return False


def _availability_priority(record):
	return {UNAVAILABLE: 3, REDUCED_CAPACITY: 2, "available": 1}.get(
		str(record.get("statusCode") or "available"), 0
	)


def _area_specificity(record, area):
	return 1 if _norm(record.get("areaLabel")) == _norm(area) and _norm(record.get("areaLabel")) else 0


def _json_list(value):
	try:
		parsed = frappe.parse_json(value or "[]")
	except (TypeError, ValueError):
		return []
	return parsed if isinstance(parsed, list) else []


def _norm(value):
	return str(value or "").strip().casefold()
