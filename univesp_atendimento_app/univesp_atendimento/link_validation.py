import hashlib


OUTCOMES = {"verified", "inconclusive", "not_found", "conflicting", "unavailable"}


def cpf_hash(value):
	return hashlib.sha256(str(value or "").encode("utf-8")).hexdigest()


def classify_link(candidate, supplied):
	if not candidate:
		return "not_found"
	checks = {
		"email": normalize(candidate.get("email")) == normalize(supplied.get("email")),
		"ra": normalize(candidate.get("ra")) == normalize(supplied.get("ra")),
		"curso": normalize(candidate.get("curso")) == normalize(supplied.get("curso")),
		"polo": normalize(candidate.get("polo_id")) == normalize(supplied.get("polo")),
	}
	provided = [key for key in checks if normalize(supplied.get(key))]
	if len(provided) < 2:
		return "inconclusive"
	return "verified" if all(checks[key] for key in provided) else "conflicting"


def normalize(value):
	return str(value or "").strip().casefold()
