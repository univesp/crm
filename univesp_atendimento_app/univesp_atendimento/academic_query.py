"""Porta de consultas academicas — stub para Trino/lake (Fase D)."""

from __future__ import annotations

from typing import Any, Protocol


class AcademicQueryPort(Protocol):
	def get_student_summary(self, ra: str) -> dict[str, Any]: ...

	def list_current_disciplines(self, ra: str) -> list[dict[str, Any]]: ...


class StubAcademicQueryService:
	"""Implementacao vazia ate camada analitica estar disponivel."""

	def get_student_summary(self, ra: str) -> dict[str, Any]:
		return {"ra": ra, "status": "unavailable", "message": "Consulta academica nao habilitada."}

	def list_current_disciplines(self, ra: str) -> list[dict[str, Any]]:
		return []


def get_academic_query_service() -> AcademicQueryPort:
	return StubAcademicQueryService()
