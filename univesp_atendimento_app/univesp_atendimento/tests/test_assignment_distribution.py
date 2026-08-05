from unittest import TestCase

from univesp_atendimento.assignment_distribution import _choose, _unassigned


def _member(profile_id, email, profile_key="analista_area"):
	return {
		"profile_id": profile_id,
		"email": email,
		"display_name": profile_id,
		"profile_key": profile_key,
	}


class TestAssignmentDistribution(TestCase):
	def test_automatic_choice_uses_weighted_load_and_capacity(self):
		pool = [_member("analyst-a", "a@univesp.br"), _member("analyst-b", "b@univesp.br")]
		availability = {
			"analyst-a": {"status": "available", "capacity_factor": 1},
			"analyst-b": {"status": "reduced_capacity", "capacity_factor": 0.5},
		}
		workload = {
			"a@univesp.br": {"active_cases": 1, "risk_cases": 0, "overdue_cases": 0},
			"b@univesp.br": {"active_cases": 1, "risk_cases": 0, "overdue_cases": 0},
		}

		winner = _choose(pool, availability, workload)

		self.assertEqual(winner["member"]["profile_id"], "analyst-a")
		self.assertEqual(winner["score"], 1)

	def test_unavailable_user_is_not_eligible(self):
		pool = [_member("analyst-a", "a@univesp.br")]
		winner = _choose(
			pool,
			{"analyst-a": {"status": "unavailable", "capacity_factor": 0}},
			{},
		)

		self.assertIsNone(winner)

	def test_tie_uses_stable_profile_id(self):
		pool = [_member("profile-z", "z@univesp.br"), _member("profile-a", "a@univesp.br")]

		winner = _choose(pool, {}, {})

		self.assertEqual(winner["member"]["profile_id"], "profile-a")

	def test_restricted_failure_is_explicit_and_keeps_case_unassigned(self):
		result = _unassigned(
			"restricted_no_eligible",
			"A regra restrita não possui pessoa apta no período atual.",
			area="sra",
			mode="restricted",
			members=[_member("analyst-a", "a@univesp.br")],
			availability={"analyst-a": {"status": "unavailable", "capacity_factor": 0}},
		)

		self.assertEqual(result["status"], "unassigned_exception")
		self.assertEqual(result["resolution_mode"], "restricted")
		self.assertEqual(result["unavailable_profile_ids"], ["analyst-a"])
