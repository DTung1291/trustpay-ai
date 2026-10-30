// Client-side mirrors of the checks the contract is specified to enforce.
// They give fast feedback only. The contract remains the authority.

export const LIMITS = {
  title: 120,
  description: 2000,
  milestoneTitle: 120,
  criterion: 300,
  maxMilestones: 5,
  maxCriteria: 10,
  url: 500,
} as const

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const SHA_RE = /^[0-9a-fA-F]{40}$/
// eslint-disable-next-line no-control-regex
const CONTROL_OR_SPACE_RE = /[\u0000-\u0020\u007f]/

export function isAddress(value: string): boolean {
  return ADDRESS_RE.test(value.trim())
}

export function sameAddress(a?: string, b?: string): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase()
}

export function validateEvidenceUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value) return 'Evidence URL is required.'
  if (value.length > LIMITS.url) return `URL must be at most ${LIMITS.url} characters.`
  if (CONTROL_OR_SPACE_RE.test(value)) return 'URL must not contain spaces or control characters.'
  if (!value.startsWith('https://')) return 'Evidence must be a public https:// URL.'
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return 'That is not a valid URL.'
  }
  if (parsed.username || parsed.password) return 'URLs with embedded credentials are not allowed.'
  if (parsed.hostname !== 'github.com' && parsed.hostname !== 'raw.githubusercontent.com')
    return 'Evidence must be a public GitHub file URL.'
  if (parsed.search || parsed.hash) return 'Evidence URL must not contain a query string or fragment.'
  const parts = parsed.pathname.replace(/^\//, '').split('/')
  const isBlob = parsed.hostname === 'github.com' && parts.length >= 5 && parts[2] === 'blob'
  const isRaw = parsed.hostname === 'raw.githubusercontent.com' && parts.length >= 4
  if (!isBlob && !isRaw)
    return 'Use an immutable GitHub file URL containing the full commit SHA.'
  const ref = parsed.hostname === 'github.com' ? parts[3] : parts[2]
  if (!SHA_RE.test(ref)) return 'The GitHub file URL must contain a full 40-character commit SHA.'
  return null
}

export function validateCommitSha(raw: string): string | null {
  const value = raw.trim()
  return SHA_RE.test(value) ? null : 'A full 40-character commit SHA is required.'
}

export function validateEvidenceSubmission(rawUrl: string, rawSha: string): string | null {
  const urlProblem = validateEvidenceUrl(rawUrl)
  if (urlProblem) return urlProblem
  const shaProblem = validateCommitSha(rawSha)
  if (shaProblem) return shaProblem
  const parsed = new URL(rawUrl.trim())
  const parts = parsed.pathname.replace(/^\//, '').split('/')
  const ref = parsed.hostname === 'github.com' ? parts[3] : parts[2]
  return ref.toLowerCase() === rawSha.trim().toLowerCase()
    ? null
    : 'The commit SHA in the evidence URL must match the submitted commit SHA.'
}

export function isGithubEvidence(raw: string): boolean {
  try {
    const host = new URL(raw).hostname
    return host === 'github.com' || host === 'raw.githubusercontent.com'
  } catch {
    return false
  }
}

export interface AgreementFormInput {
  title: string
  description: string
  freelancer: string
  milestones: { title: string; criteria: string[] }[]
}

export function validateAgreementForm(
  input: AgreementFormInput,
  clientAddress?: string,
): string | null {
  if (!input.title.trim()) return 'Project title is required.'
  if (input.title.trim().length > LIMITS.title) return `Title must be at most ${LIMITS.title} characters.`
  if (!input.description.trim()) return 'Project description is required.'
  if (input.description.trim().length > LIMITS.description)
    return `Description must be at most ${LIMITS.description} characters.`
  if (!isAddress(input.freelancer)) return 'Freelancer must be a valid 0x wallet address.'
  if (sameAddress(input.freelancer.trim(), clientAddress))
    return 'Freelancer must be a different wallet than yours.'
  if (input.milestones.length === 0) return 'Add at least one milestone.'
  if (input.milestones.length > LIMITS.maxMilestones)
    return `At most ${LIMITS.maxMilestones} milestones are allowed.`
  for (const [i, m] of input.milestones.entries()) {
    const label = `Milestone ${i + 1}`
    if (!m.title.trim()) return `${label} needs a title.`
    if (m.title.trim().length > LIMITS.milestoneTitle) return `${label} title is too long.`
    const criteria = m.criteria.map((c) => c.trim()).filter(Boolean)
    if (criteria.length === 0) return `${label} needs at least one acceptance criterion.`
    if (criteria.length > LIMITS.maxCriteria) return `${label} has too many criteria.`
    if (criteria.some((c) => c.length > LIMITS.criterion))
      return `${label} has a criterion over ${LIMITS.criterion} characters.`
  }
  return null
}

export function serializeMilestones(milestones: { title: string; criteria: string[] }[]): string {
  return JSON.stringify(
    milestones.map((m) => ({
      title: m.title.trim(),
      criteria: m.criteria.map((c) => c.trim()).filter(Boolean),
    })),
  )
}

export function shortAddress(address?: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
