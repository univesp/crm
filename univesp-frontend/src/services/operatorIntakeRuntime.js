import loggedStudent from '../../mocks/usuario-logado.json'
import { operatorCaseSeeds } from '../../mocks/operations'
import { buildCaseRoutingContext } from '@/services/caseRoutingRuntime'

function pad(value) {
  return String(value).padStart(2, '0')
}

function padMilliseconds(value) {
  return String(value).padStart(3, '0')
}

function normalizeDate(value = new Date()) {
  return value instanceof Date ? value : new Date(value)
}

function buildTimestampParts(value = new Date()) {
  const date = normalizeDate(value)

  return {
    iso: date.toISOString(),
    compact: [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
      padMilliseconds(date.getMilliseconds()),
    ].join(''),
    label: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function capitalize(value = '') {
  const normalized = String(value || '').trim()

  if (!normalized) {
    return ''
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function buildPriorityLabel(criticality = '') {
  const normalized = normalizeText(criticality)

  if (normalized === 'critica') {
    return 'Maxima'
  }

  if (normalized === 'alta') {
    return 'Alta'
  }

  if (normalized === 'baixa') {
    return 'Baixa'
  }

  return 'Media'
}

function buildStudentKey(student) {
  return [student.ra, student.email, student.nome]
    .map((value) => normalizeText(value))
    .find(Boolean)
}

export function buildOperationalStudentDirectory() {
  const catalog = [loggedStudent, ...operatorCaseSeeds.map((seed) => seed.studentData)]
  const byKey = new Map()

  for (const student of catalog) {
    const key = buildStudentKey(student)

    if (!key || byKey.has(key)) {
      continue
    }

    byKey.set(key, {
      nome: student.nome || '',
      email: student.email || '',
      ra: student.ra || '',
      curso: student.curso || '',
      polo: student.polo || '',
    })
  }

  return [...byKey.values()].sort((left, right) => left.nome.localeCompare(right.nome, 'pt-BR'))
}

export function buildOperatorAssistedCase({
  studentData,
  context,
  verifiedSummary = '',
  contactChannel = 'telefone',
  actorName = '',
  currentDate = new Date(),
}) {
  const timestamp = buildTimestampParts(currentDate)
  const protocolNumber = `UVSP-${timestamp.compact.slice(0, 8)}-${timestamp.compact.slice(8, 14)}`
  const channelLabel =
    contactChannel === 'presencial' ? 'Atendimento presencial' : 'Atendimento por telefone'
  const routing = buildCaseRoutingContext({
    studentPolo: studentData.polo,
    theme: context.theme,
    subtheme: context.subtheme,
    queueDestination: context.queueDestination,
    criticality: context.criticality,
    entryOrigin: channelLabel,
  })
  const intakeSummary =
    verifiedSummary.trim() ||
    'Triagem inicial registrada pelo OP antes de decidir a proxima tratativa.'

  return {
    id: protocolNumber,
    protocolNumber,
    createdAt: timestamp.iso,
    createdAtLabel: timestamp.label,
    updatedAt: timestamp.iso,
    updatedAtLabel: timestamp.label,
    statusCode: 'em_validacao_operacional',
    statusGroup: 'submitted',
    statusLabel: 'Em validacao operacional',
    studentState: 'waiting',
    subject: context.subject,
    priorityLabel: buildPriorityLabel(context.criticality),
    queueLabel: routing.currentQueueLabel,
    lastMileAreaLabel: routing.targetAreaLabel,
    slaLabel: context.sla || 'Nao informado',
    pendingLabel: 'Triagem inicial registrada pelo OP',
    source: 'operador_polo',
    sourceLabel: 'Atendimento pelo OP',
    assignedOperator: actorName,
    studentData: {
      nome: studentData.nome,
      email: studentData.email || '',
      ra: studentData.ra || '',
      curso: studentData.curso || '',
      polo: studentData.polo,
    },
    operatorIntake: {
      channel: contactChannel,
      channelLabel,
      verifiedSummary: intakeSummary,
      openedBy: actorName || 'Operacao do polo',
      openedAt: timestamp.iso,
      openedAtLabel: timestamp.label,
    },
    context: {
      ...context,
      entryOrigin: channelLabel,
      studentPolo: studentData.polo,
      routing,
    },
    attachments: [],
    timeline: [
      {
        id: `TL-${timestamp.compact}-1`,
        title: 'Atendimento iniciado pelo OP',
        description: `${capitalize(channelLabel)} com triagem inicial registrada em nome do aluno.`,
        at: timestamp.iso,
        atLabel: timestamp.label,
        tone: 'primary',
      },
      {
        id: `TL-${timestamp.compact}-2`,
        title: 'Orientacao consultada antes da decisao',
        description: `Caminho consultado: ${context.breadcrumb.join(' > ')}.`,
        at: timestamp.iso,
        atLabel: timestamp.label,
        tone: 'info',
      },
      {
        id: `TL-${timestamp.compact}-3`,
        title: 'Triagem inicial registrada',
        description: intakeSummary,
        at: timestamp.iso,
        atLabel: timestamp.label,
        tone: 'warning',
      },
    ],
    interactions: [
      {
        id: `INT-${timestamp.compact}-1`,
        actor: actorName || 'Operador de Polo',
        channel: channelLabel,
        text: intakeSummary,
        at: timestamp.iso,
        atLabel: timestamp.label,
      },
    ],
  }
}
