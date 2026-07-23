const hasOwn = (catalog, value) => Object.prototype.hasOwnProperty.call(catalog, value)

export const FAQ_ENUM_FIELD_BINDINGS = Object.freeze({
  action: 'acao',
  criticality: 'criticidade_padrao',
  sla: 'sla_padrao',
  faq_type: 'tipo_faq',
  node_type: 'node_kind',
  queue_destination: 'fila_destino',
})

export const ACTION_CATALOG = Object.freeze({
  mostrar_resposta: Object.freeze({
    label: 'Mostrar resposta',
    opensTicket: false,
    terminal: true,
  }),
  ir_para_subniveis: Object.freeze({
    label: 'Ir para subniveis',
    opensTicket: false,
    terminal: false,
  }),
  abrir_atendimento: Object.freeze({
    label: 'Abrir atendimento',
    opensTicket: true,
    terminal: true,
  }),
  abrir_atendimento_com_anexo: Object.freeze({
    label: 'Abrir atendimento com anexo',
    opensTicket: true,
    terminal: true,
    requiresAttachment: true,
  }),
  encerrar_com_registro: Object.freeze({
    label: 'Encerrar com registro',
    opensTicket: false,
    terminal: true,
    recordOnly: true,
  }),
  encaminhar_para_op: Object.freeze({
    label: 'Encaminhar para OP',
    opensTicket: true,
    terminal: true,
    queueRole: 'op',
  }),
  encaminhar_para_area: Object.freeze({
    label: 'Encaminhar para area',
    opensTicket: true,
    terminal: true,
    queueRole: 'area_interna',
  }),
  solicitar_documento: Object.freeze({
    label: 'Solicitar documento',
    opensTicket: true,
    terminal: true,
    requiresAttachment: true,
  }),
})

export const CRITICALITY_CATALOG = Object.freeze({
  baixa: Object.freeze({ label: 'Baixa', rank: 1 }),
  media: Object.freeze({ label: 'Media', rank: 2 }),
  alta: Object.freeze({ label: 'Alta', rank: 3 }),
  critica: Object.freeze({ label: 'Critica', rank: 4 }),
})

export const SLA_CATALOG = Object.freeze({
  '4h': Object.freeze({ label: '4 horas', hours: 4 }),
  '8h': Object.freeze({ label: '8 horas', hours: 8 }),
  '24h': Object.freeze({ label: '24 horas', hours: 24 }),
  '48h': Object.freeze({ label: '48 horas', hours: 48 }),
  '72h': Object.freeze({ label: '72 horas', hours: 72 }),
})

export const FAQ_TYPE_CATALOG = Object.freeze({
  aluno: Object.freeze({
    label: 'Aluno / ex-aluno',
    profile: 'aluno',
  }),
  op: Object.freeze({
    label: 'FAQ operacional do OP',
    profile: 'op',
  }),
  publico: Object.freeze({
    label: 'FAQ publica (nao-aluno)',
    profile: 'publico',
  }),
})

export const NODE_TYPE_CATALOG = Object.freeze({
  theme: Object.freeze({
    label: 'Tema principal',
    terminal: false,
  }),
  branch: Object.freeze({
    label: 'Ramo intermediario',
    terminal: false,
  }),
  leaf: Object.freeze({
    label: 'No terminal',
    terminal: true,
  }),
})

export const QUEUE_DESTINATION_CATALOG = Object.freeze({
  nao_aplicavel: Object.freeze({
    label: 'Nao aplicavel',
    owner: 'nenhum',
  }),
  op: Object.freeze({
    label: 'Fila do OP',
    owner: 'operacao',
  }),
  sra: Object.freeze({
    label: 'Secretaria e registro academico',
    owner: 'area_interna',
  }),
  suporte_academico_digital: Object.freeze({
    label: 'Suporte academico digital',
    owner: 'area_interna',
  }),
})

export const FAQ_OFFICIAL_CATALOGS = Object.freeze({
  action: ACTION_CATALOG,
  criticality: CRITICALITY_CATALOG,
  sla: SLA_CATALOG,
  faq_type: FAQ_TYPE_CATALOG,
  node_type: NODE_TYPE_CATALOG,
  queue_destination: QUEUE_DESTINATION_CATALOG,
})

export function getCatalogKeys(catalog) {
  return Object.keys(catalog)
}

export function hasCatalogValue(catalog, value) {
  return typeof value === 'string' && hasOwn(catalog, value)
}

export function getCatalogEntry(catalog, value, fallback = null) {
  return hasCatalogValue(catalog, value) ? catalog[value] : fallback
}

export function getOfficialFaqCatalogs() {
  return FAQ_OFFICIAL_CATALOGS
}
