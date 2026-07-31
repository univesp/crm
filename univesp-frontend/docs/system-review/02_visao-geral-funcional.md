# Visao geral funcional

## O que e o sistema

E uma plataforma de atendimento CRM/backoffice para operacao academica, com experiencia separada por perfil, cobrindo:

- autosservico e protocolo do aluno
- operacao de polo (fila, analise e abertura assistida)
- operacao especializada de area (analista e gestor)
- governanca administrativa (dashboard, FAQ, parametros, permissao e publicacao)

## Como funciona em alto nivel

1. O usuario autentica por SSO (ou bypass local em desenvolvimento)
2. O router valida perfil e acoes permitidas por rota
3. O store central monta contexto por perfil/polo/area
4. Paginas consomem runtimes especializados (fila, detalhe, governanca, admin)
5. Acoes de atendimento geram eventos, assignment, routing e knowledge usage

**Evidencia:** [COD] `src/main.js`, `src/router.js`, `src/stores/auth.js`, `src/stores/studentSupport.js`, `src/repositories/runtimeRepositories.js`.

## Modulos identificados

- Autenticacao e acesso local (`/login`, `/acesso-local`)
- Institucional/diagnostico (`/`, `/triagem`, `/ticket`, `/handoff`, `/integracoes`)
- Jornada do aluno (`/aluno/*`)
- OP e gestor de polos (`/op/*`)
- Area (analista e gestor de area) (`/area/*`)
- Admin central (`/admin/*`)
- Wireframe navegavel de aluno (`/wireframes/aluno/:screenId?`)

## Mapa de maturidade por bloco

### Bloco pronto para uso funcional em mock

- rotas por perfil
- fila OP e detalhe do caso
- fila Area e detalhe orientado a decisao
- governanca de area (visibilidade por assunto e disponibilidade)
- dashboard admin com filtros
- base canonica de conhecimento/versionamento/sugestao

### Bloco parcialmente mockado, mas com arquitetura encaminhada

- abertura e persistencia de protocolo em backend real
- publicacao definitiva de versao para API externa
- trilha de auditoria em banco (atualmente local)
- motor de distribuicao rodando contra fonte remota

### Bloco mais conceitual/demonstrativo

- paginas institucionais (`/triagem`, `/ticket`, `/handoff`, `/integracoes`) focadas em blueprint de produto
- wireframe de aluno para exploracao de UX

## O que esta parametrizavel hoje

- perfis e escopo local por mocks (`mockAccessProfiles`)
- regras de visibilidade por assunto/subassunto (area)
- disponibilidade de usuario (inclui indisponibilidade temporal e capacidade reduzida)
- niveis de SLA e criticidade (admin parametros)
- matriz de permissao por escopo (admin permissoes)
- versao e publicacao de bundle de conhecimento (admin publicacao)

## Como as partes se conectam

### Camada de UI

- `src/pages/*`
- `src/components/*`
- shell unico em `src/App.vue`, variando por `shellKey` e perfil

### Camada de negocio em frontend

- runtimes de fila, caso, governanca e admin em `src/services/*Runtime.js`
- motor de distribuicao em `src/services/distributionEngine.js`

### Camada de estado e persistencia local

- store central `src/stores/studentSupport.js`
- `localStorage` para sessao e dados mock operacionais

### Camada de repositorio (ponte para backend futuro)

- `src/repositories/runtimeRepositories.js`
- padroniza acesso a conhecimento, casos e governanca

## Pontos de coerencia funcional bem estabelecidos

- status canonicos definidos e reaproveitados entre modulos
- separacao de perfil entre analista e gestor de area
- hierarquia de decisao no detalhe da area (resolver > complementar > concluir > excecao)
- rastro de uso de conhecimento por caso

## Pontos que ainda exigem validacao externa

- consistencia final de todos os fluxos em dados de alto volume
- cobertura de edge cases com indisponibilidade simultanea
- convergencia total entre nomenclatura de UI e nomenclatura de modelo
- estrategia de sincronizacao eventual entre local state e backend real

