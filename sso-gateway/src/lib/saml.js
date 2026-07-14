import { Strategy as SamlStrategy } from '@node-saml/passport-saml'

const EMAIL_ATTRIBUTES = [
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn',
  'urn:oid:0.9.2342.19200300.100.1.3',
  'email',
  'mail',
]

export function extractEmailFromSaml(profile) {
  for (const key of EMAIL_ATTRIBUTES) {
    const value = profile[key]
    if (!value) continue
    return String(Array.isArray(value) ? value[0] : value).trim()
  }
  return String(profile.nameID || '').trim()
}

export function createSamlStrategy() {
  const cert = process.env.SAML_IDP_CERT
  if (!cert) throw new Error('SAML_IDP_CERT nao definido.')

  return new SamlStrategy(
    {
      entryPoint: process.env.SAML_IDP_SSO_URL,
      logoutUrl: process.env.SAML_IDP_SLO_URL,
      callbackUrl: process.env.SAML_ACS_URL,
      issuer: process.env.SAML_ENTITY_ID,
      idpCert: cert,
      identifierFormat: null,
      wantAuthnResponseSigned: true,
    },
    (profile, done) => done(null, profile),
  )
}
