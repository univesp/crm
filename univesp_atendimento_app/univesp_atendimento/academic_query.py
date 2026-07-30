"""Porta de consultas academicas — stub para Trino/lake (Fase D)."""

from __future__ import annotations

from typing import Any, Protocol

HOMOLOG_ACADEMIC_DATA: dict[str, dict[str, Any]] = {
	"HOMOLOG001": {
		"summary": {
			"ra": "HOMOLOG001",
			"status": "active",
			"nome": "Aluno Homolog",
			"curso": "Licenciatura em Computacao",
			"polo_id": "237",
			"polo_nome": "Polo Homolog SP",
			"situacao": "Ativo",
			"periodo_atual": "2026.1",
			"source": "homolog_stub",
		},
		"disciplines": [
			{"code": "COMP101", "name": "Introducao a Programacao", "status": "cursando"},
			{"code": "MAT201", "name": "Calculo I", "status": "cursando"},
		],
	},
	"HOMOLOG002": {
		"summary": {
			"ra": "HOMOLOG002",
			"status": "active",
			"nome": "Aluno Homolog Dois",
			"curso": "Administracao",
			"polo_id": "237",
			"polo_nome": "Polo Homolog SP",
			"situacao": "Ativo",
			"periodo_atual": "2026.1",
			"source": "homolog_stub",
		},
		"disciplines": [
			{"code": "ADM101", "name": "Introducao a Administracao", "status": "cursando"},
		],
	},
	"HOMOLOG003": {
		"summary": {
			"ra": "HOMOLOG003",
			"status": "active",
			"nome": "Aluno Homolog Tres",
			"curso": "Pedagogia",
			"polo_id": "238",
			"polo_nome": "Polo Homolog RJ",
			"situacao": "Ativo",
			"periodo_atual": "2026.1",
			"source": "homolog_stub",
		},
		"disciplines": [
			{"code": "PED101", "name": "Fundamentos da Educacao", "status": "cursando"},
		],
	},
}


class AcademicQueryPort(Protocol):
	def get_student_summary(self, ra: str) -> dict[str, Any]: ...

	def list_current_disciplines(self, ra: str) -> list[dict[str, Any]]: ...


class StubAcademicQueryService:
	"""Stub com dados HOMOLOG* ate camada analitica estar disponivel."""

	def get_student_summary(self, ra: str) -> dict[str, Any]:
		normalized = str(ra or "").strip().upper()
		entry = HOMOLOG_ACADEMIC_DATA.get(normalized)
		if entry:
			return dict(entry["summary"])
		return {"ra": ra, "status": "unavailable", "message": "Consulta academica nao habilitada."}

	def list_current_disciplines(self, ra: str) -> list[dict[str, Any]]:
		normalized = str(ra or "").strip().upper()
		entry = HOMOLOG_ACADEMIC_DATA.get(normalized)
		if entry:
			return list(entry["disciplines"])
		return []


def get_academic_query_service() -> AcademicQueryPort:
	return StubAcademicQueryService()
