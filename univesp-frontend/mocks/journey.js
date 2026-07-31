export const defaultAnswersByFlow = {
  matricula: {
    persona: 'active_student',
    need: 're_enrollment',
    urgency: 'this_week',
    evidence: 'has_attachment',
  },
  financeiro: {
    persona: 'student_owner',
    need: 'duplicate_invoice',
    urgency: 'due_today',
    evidence: 'invoice_number',
  },
  documentos: {
    persona: 'active_student',
    need: 'enrollment_statement',
    urgency: 'week',
    evidence: 'clear_path',
  },
  ava: {
    persona: 'course_access',
    need: 'hard_block',
    urgency: 'assessment_today',
    evidence: 'print_and_error',
  },
}

export const mockCustomer = {
  name: 'Marina Costa',
  email: 'marina.costa@example.com',
  ra: '22100489',
  polo: 'Polo Guarulhos',
  course: 'Pedagogia',
  channel: 'Portal UNIVESP',
  ssoStatus: 'Autenticado via SAML',
}

export const mockSession = {
  protocol: 'UVSP-20260319-104',
  stage: 'overview',
  priority: 'Alta',
}
