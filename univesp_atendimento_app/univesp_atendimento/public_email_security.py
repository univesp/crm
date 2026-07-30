import hashlib
import hmac
import re


def sign_reply(secret, ticket_id, email):
	return hmac.new(
		str(secret or "").encode("utf-8"),
		f"{ticket_id}:{str(email or '').strip().lower()}".encode("utf-8"),
		hashlib.sha256,
	).hexdigest()[:32]


def parse_reply_recipient(value):
	match = re.search(r"reply\+([^.@]+)\.([A-Za-z0-9_-]+)@", str(value or ""))
	return (match.group(1), match.group(2)) if match else ("", "")


def verify_reply(secret, ticket_id, email, supplied):
	return hmac.compare_digest(sign_reply(secret, ticket_id, email), str(supplied or ""))
