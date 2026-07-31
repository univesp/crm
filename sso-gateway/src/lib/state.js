import jwt from 'jsonwebtoken'

function secret() {
  const value = process.env.JWT_SECRET
  if (!value) throw new Error('JWT_SECRET nao definido.')
  return value
}

export function signState(payload) {
  return jwt.sign(payload, secret(), { expiresIn: '15m' })
}

export function verifyState(token) {
  return jwt.verify(token, secret())
}
