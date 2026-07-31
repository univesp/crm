import { computed, reactive, ref } from 'vue'

import {
  createProfileAssignment,
  listAccessGroups,
  listAdminUsers,
  listPermissionProfiles,
  listProfileAssignments,
  revokeProfileAssignment,
} from '@/services/appApi'
import {
  filterContributorAssignments,
  isContributorProfile,
} from '@/services/knowledgePermissionsRuntime'

export function useFaqKnowledgeGrants() {
  const loading = ref(false)
  const saving = ref(false)
  const errorMessage = ref('')
  const successMessage = ref('')

  const catalogs = reactive({
    users: [],
    groups: [],
    profiles: [],
    allProfiles: [],
    assignments: [],
    themes: [],
  })

  const grantForm = reactive({
    subject_type: 'person',
    subject_id: '',
    permission_profile: '',
    theme_keys: [],
    valid_from: '',
    valid_until: '',
    justification: '',
  })

  const contributorProfiles = computed(() =>
    catalogs.allProfiles.filter(isContributorProfile),
  )

  const contributorAssignments = computed(() =>
    filterContributorAssignments(catalogs.assignments, catalogs.allProfiles),
  )

  const grantSubjects = computed(() =>
    grantForm.subject_type === 'group'
      ? catalogs.groups.map((group) => ({
          value: group.id,
          label: group.label,
          base_persona: catalogs.allProfiles.find(
            (profile) => profile.id === group.permission_profile,
          )?.base_persona,
        }))
      : catalogs.users
          .filter((user) => ['op', 'op_externo'].includes(user.profile_key))
          .map((user) => ({
            value: user.email,
            label: `${user.display_name || user.email} · ${user.profile_key === 'op_externo' ? 'BPO' : 'OP'}`,
            base_persona: user.profile_key,
          })),
  )

  const eligibleGrantProfiles = computed(() => {
    const selected = grantSubjects.value.find((item) => item.value === grantForm.subject_id)
    return selected
      ? contributorProfiles.value.filter((profile) => profile.base_persona === selected.base_persona)
      : contributorProfiles.value
  })

  async function loadGrantCatalogs(themes = []) {
    loading.value = true
    errorMessage.value = ''
    try {
      const [usersResponse, groupsResponse, profilesResponse, assignmentsResponse] =
        await Promise.all([
          listAdminUsers({ page_size: 200 }),
          listAccessGroups(),
          listPermissionProfiles(),
          listProfileAssignments(),
        ])
      catalogs.users = usersResponse.data || []
      catalogs.groups = groupsResponse.data || []
      catalogs.allProfiles = profilesResponse.data || []
      catalogs.profiles = contributorProfiles.value
      catalogs.assignments = assignmentsResponse.data || []
      catalogs.themes = themes
      if (!grantForm.permission_profile && catalogs.profiles.length) {
        grantForm.permission_profile = catalogs.profiles[0].id
      }
    } catch {
      catalogs.users = []
      catalogs.groups = []
      catalogs.allProfiles = []
      catalogs.profiles = []
      catalogs.assignments = []
      catalogs.themes = themes
    } finally {
      loading.value = false
    }
  }

  function onGrantSubjectChange() {
    const first = eligibleGrantProfiles.value[0]
    grantForm.permission_profile = first?.id || ''
  }

  function prefillTheme(themeKey) {
    if (!themeKey) return
    if (!grantForm.theme_keys.includes(themeKey)) {
      grantForm.theme_keys = [themeKey]
    }
  }

  async function grantSuggestionAccess() {
    if (
      !grantForm.subject_id ||
      !grantForm.permission_profile ||
      !grantForm.theme_keys.length ||
      grantForm.justification.trim().length < 5
    ) {
      errorMessage.value = 'Selecione pessoa/grupo, temas e informe uma justificativa.'
      return false
    }
    saving.value = true
    errorMessage.value = ''
    successMessage.value = ''
    try {
      await createProfileAssignment({
        subject_type: grantForm.subject_type,
        subject_id: grantForm.subject_id,
        permission_profile: grantForm.permission_profile,
        scopes: { knowledge_themes: grantForm.theme_keys },
        valid_from: grantForm.valid_from || null,
        valid_until: grantForm.valid_until || null,
        reason: grantForm.justification.trim(),
      })
      successMessage.value = 'Permissão para sugerir concedida no escopo e período informados.'
      Object.assign(grantForm, {
        subject_id: '',
        theme_keys: grantForm.theme_keys.length === 1 ? [...grantForm.theme_keys] : [],
        valid_from: '',
        valid_until: '',
        justification: '',
      })
      catalogs.assignments = (await listProfileAssignments()).data || []
      return true
    } catch (error) {
      errorMessage.value = error?.message || 'Não foi possível conceder a permissão.'
      return false
    } finally {
      saving.value = false
    }
  }

  async function revokeSuggestionAccess(assignment) {
    if (!window.confirm(`Revogar a permissão de ${assignment.subject_id}?`)) return false
    errorMessage.value = ''
    successMessage.value = ''
    try {
      await revokeProfileAssignment(assignment.id)
      successMessage.value = 'Permissão revogada.'
      catalogs.assignments = (await listProfileAssignments()).data || []
      return true
    } catch (error) {
      errorMessage.value = error?.message || 'Não foi possível revogar a permissão.'
      return false
    }
  }

  return {
    loading,
    saving,
    errorMessage,
    successMessage,
    catalogs,
    grantForm,
    contributorProfiles,
    contributorAssignments,
    grantSubjects,
    eligibleGrantProfiles,
    loadGrantCatalogs,
    onGrantSubjectChange,
    prefillTheme,
    grantSuggestionAccess,
    revokeSuggestionAccess,
  }
}
