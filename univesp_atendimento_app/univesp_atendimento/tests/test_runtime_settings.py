from unittest import TestCase

from univesp_atendimento.api.v1.settings import (
	RuntimeSettingsValidationError,
	_validate_parameters,
)


class TestRuntimeSettings(TestCase):
	def test_accepts_bounded_canonical_collections(self):
		_validate_parameters(
			{
				"criticalityLevels": [{"key": "high", "label": "Alta"}],
				"slaLevels": [{"key": "standard", "label": "Padrao"}],
				"applicationRules": [{"id": "rule-1", "targetType": "queue"}],
			}
		)

	def test_rejects_missing_collection(self):
		with self.assertRaises(RuntimeSettingsValidationError):
			_validate_parameters({"criticalityLevels": [], "slaLevels": []})

	def test_rejects_duplicate_identifiers(self):
		with self.assertRaises(RuntimeSettingsValidationError):
			_validate_parameters(
				{
					"criticalityLevels": [{"key": "high"}, {"key": "high"}],
					"slaLevels": [],
					"applicationRules": [],
				}
			)

	def test_rejects_oversized_payload(self):
		with self.assertRaises(RuntimeSettingsValidationError):
			_validate_parameters(
				{
					"criticalityLevels": [{"key": "high", "description": "x" * 270_000}],
					"slaLevels": [],
					"applicationRules": [],
				}
			)
