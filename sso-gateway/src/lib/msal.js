import { ConfidentialClientApplication } from '@azure/msal-node'

const SCOPES = ['openid', 'profile', 'email']

function buildConfig(tenant) {
  const isAdmin = tenant === 'admin'
  const clientId = isAdmin ? process.env.AZURE_ADMIN_CLIENT_ID : process.env.AZURE_ACADEMICO_CLIENT_ID
  const tenantId = isAdmin ? process.env.AZURE_ADMIN_TENANT_ID : process.env.AZURE_ACADEMICO_TENANT_ID
  const clientSecret = isAdmin
    ? process.env.AZURE_ADMIN_CLIENT_SECRET
    : process.env.AZURE_ACADEMICO_CLIENT_SECRET

  if (!clientId || !tenantId || !clientSecret) {
    throw new Error(`Configuracao Azure incompleta para tenant "${tenant}".`)
  }

  return new ConfidentialClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      clientSecret,
    },
  })
}

export async function getAuthCodeUrl(tenant, state, loginHint, nonce) {
  return buildConfig(tenant).getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: process.env.AZURE_REDIRECT_URI,
    state,
    nonce,
    prompt: 'select_account',
    loginHint: loginHint || undefined,
  })
}

export async function acquireTokenByCode(tenant, code) {
  return buildConfig(tenant).acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: process.env.AZURE_REDIRECT_URI,
  })
}
