/** Stub frontend — consultas academicas (Fase D). */

export async function fetchStudentAcademicSummary(_ra) {
  return {
    status: 'unavailable',
    message: 'Consulta academica ainda nao habilitada neste ambiente.',
  }
}

export async function fetchCurrentDisciplines(_ra) {
  return []
}
