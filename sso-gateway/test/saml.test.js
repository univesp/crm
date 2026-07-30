import assert from 'node:assert/strict'
import test from 'node:test'

import { createSamlStrategy } from '../src/lib/saml.js'

test('creates the SAML strategy with the configured IdP certificate', () => {
  const previous = {
    SAML_IDP_CERT: process.env.SAML_IDP_CERT,
    SAML_IDP_SSO_URL: process.env.SAML_IDP_SSO_URL,
    SAML_ACS_URL: process.env.SAML_ACS_URL,
    SAML_ENTITY_ID: process.env.SAML_ENTITY_ID,
  }

  Object.assign(process.env, {
    SAML_IDP_CERT: 'test-certificate',
    SAML_IDP_SSO_URL: 'https://idp.example.test/sso',
    SAML_ACS_URL: 'https://app.example.test/api/sso/saml/callback',
    SAML_ENTITY_ID: 'univesp-crm-test',
  })

  try {
    assert.doesNotThrow(() => createSamlStrategy())
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})