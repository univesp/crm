import { ref } from 'vue'

import { validateStudent, isMockRuntimeEnabled } from '@/services/appApi'

const cachedStudent = ref(null)
const validationError = ref('')

export function useStudentDirectoryValidation() {
  async function validateForSession(user = {}) {
    if (isMockRuntimeEnabled()) {
      cachedStudent.value = {
        nome: user.displayName || user.name,
        ra: user.ra || '',
        polo_nome: user.currentPolo || '',
      }
      return cachedStudent.value
    }

    validationError.value = ''
    try {
      const response = await validateStudent({
        email: user.email,
        cpf: user.cpf || '',
        ra: user.ra || '',
      })
      if (!response.data?.found) {
        validationError.value = 'Cadastro nao encontrado. Confirme seus dados ou use o atendimento publico.'
        cachedStudent.value = null
        return null
      }
      cachedStudent.value = response.data.student
      return cachedStudent.value
    } catch (error) {
      validationError.value = error.message || 'Falha ao validar cadastro.'
      cachedStudent.value = null
      return null
    }
  }

  return {
    cachedStudent,
    validationError,
    validateForSession,
  }
}
