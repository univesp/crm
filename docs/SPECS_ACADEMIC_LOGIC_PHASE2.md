# Specs - Logica Academica Fase 2

## Objetivo

Preparar o CRM para respostas academicas calculadas a partir de dados oficiais, sem transformar IA ou FAQ em fonte de verdade.

Exemplo-alvo:

> "Quais disciplinas ainda preciso cursar?"

A resposta deve vir de regra academica deterministica aplicada sobre historico, matriz curricular e equivalencias oficiais.

## Principios

- O frontend nao calcula regra academica critica.
- A FAQ pode identificar a intencao e explicar o caminho.
- O backend/motor academico calcula.
- A resposta deve ser explicavel.
- Quando houver incerteza, o sistema deve abrir protocolo ou encaminhar para area responsavel.
- A fonte oficial dos dados deve ser mantida fora do `localStorage`.

## Arquitetura alvo

```text
Aluno
  -> CRM Vue
  -> Gateway/Frappe
  -> Academic Logic API
  -> Fonte oficial academica ou replica controlada
  -> Resultado estruturado
  -> Resposta explicavel no CRM
```

## Tipos de resposta

O FAQ Builder passa a classificar nos finais:

| Campo | Uso |
| --- | --- |
| `response_mode` | Define se a resposta e fixa, baseada em dados ou exige protocolo. |
| `academic_intent` | Identifica a intencao academica futura. |
| `data_contract_key` | Aponta para o contrato de dados esperado. |
| `confidence_policy` | Define quando a resposta pode ser exibida automaticamente. |

Valores iniciais:

### `response_mode`

- `informational`: orientacao fixa.
- `data_assisted`: resposta futura baseada em dados.
- `protocol_required`: exige protocolo mesmo com orientacao.

### `academic_intent`

- `none`;
- `pending_courses`;
- `enrollment_status`;
- `document_pending`;
- `course_equivalence_status`;
- `internship_eligibility`;
- `graduation_eligibility`.

### `confidence_policy`

- `answer_when_deterministic`;
- `show_with_caveat`;
- `always_open_protocol`.

## Dados minimos para resposta de disciplinas pendentes

Entrada minima:

```json
{
  "student": {
    "ra": "0000000",
    "courseId": "lic-matematica",
    "curriculumId": "matriz-2024",
    "curriculumVersion": "2024.1"
  },
  "history": [
    {
      "componentId": "MAT001",
      "name": "Calculo I",
      "status": "approved",
      "grade": 8.5,
      "workloadHours": 80,
      "completedAt": "2025-12-20"
    }
  ],
  "equivalences": [
    {
      "sourceComponentId": "OLD001",
      "targetComponentId": "MAT001",
      "status": "accepted"
    }
  ],
  "curriculum": {
    "requiredComponents": [
      {
        "componentId": "MAT001",
        "name": "Calculo I",
        "type": "required",
        "workloadHours": 80
      }
    ]
  }
}
```

Saida minima:

```json
{
  "intent": "pending_courses",
  "answerStatus": "deterministic|partial|unavailable",
  "studentRa": "0000000",
  "courseId": "lic-matematica",
  "curriculumId": "matriz-2024",
  "pendingComponents": [
    {
      "componentId": "MAT002",
      "name": "Calculo II",
      "type": "required",
      "reason": "not_completed"
    }
  ],
  "inProgressComponents": [],
  "blockedOrUncertainItems": [],
  "sourceUpdatedAt": "2026-06-19T10:00:00-03:00",
  "explanation": "Comparacao entre matriz vigente e historico consolidado.",
  "recommendedAction": "show_answer|open_protocol|escalate_area"
}
```

## Contratos de API sugeridos

### `GET /api/method/univesp.api.student.academic_summary`

Retorna resumo academico seguro para exibicao.

### `GET /api/method/univesp.api.student.pending_courses`

Calcula disciplinas pendentes do aluno autenticado.

Parametros:

- nenhum identificador de aluno vindo do browser, salvo contexto autenticado;
- opcionalmente `curriculum_id` apenas quando permitido pelo backend.

Regras:

- aluno so acessa o proprio dado;
- OP/area acessa apenas dentro do escopo do protocolo/permissao;
- resposta inclui data da fonte;
- resposta parcial precisa declarar incerteza.

### `POST /api/method/univesp.api.academic.evaluate_intent`

Recebe uma intencao academica e retorna resultado estruturado.

```json
{
  "intent": "pending_courses",
  "dataContractKey": "academic.pending_courses.v1",
  "caseContext": {
    "protocol": "UVSP-20260619-0001"
  }
}
```

## Regras de seguranca

- Nao aceitar RA arbitrario do frontend para consulta de aluno.
- Validar escopo no servidor.
- Registrar auditoria de consulta sensivel.
- Nao gravar historico academico completo no protocolo sem necessidade.
- Exibir apenas o necessario para responder a pergunta.
- Quando OP/area consultar dado academico, registrar motivo e protocolo.

## Fallbacks

Se a regra retornar `unavailable`:

- explicar que a consulta automatica nao esta disponivel;
- oferecer abertura de protocolo;
- preservar assunto/intencao academica no contexto do protocolo.

Se retornar `partial`:

- mostrar somente itens confiaveis;
- sinalizar que ha dados em analise;
- permitir protocolo para conferencia.

## Criterios de pronto da fase 2

- contrato fechado com TI/dados academicos;
- fonte oficial definida;
- regras homologadas pela area academica;
- testes com alunos ficticios cobrindo matriz atual, matriz antiga, equivalencia, reprovas e disciplinas em curso;
- auditoria de consultas;
- permissao horizontal e vertical validada;
- resposta explicavel e sem promessa indevida.
