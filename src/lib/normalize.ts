import type {
  Agreement,
  AgreementStatus,
  CriterionMet,
  CriterionResult,
  Milestone,
  MilestoneStatus,
  Outcome,
  Submission,
  Verification,
} from './types'

/** Convert calldata decoded values (Map, bigint, bytes) into plain JSON-like values. */
export function toPlain(value: unknown): unknown {
  if (value instanceof Map) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of value.entries()) out[String(k)] = toPlain(v)
    return out
  }
  if (typeof value === 'bigint') {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)
      ? Number(value)
      : value.toString()
  }
  if (value instanceof Uint8Array) {
    return `0x${Array.from(value, (b) => b.toString(16).padStart(2, '0')).join('')}`
  }
  if (Array.isArray(value)) return value.map(toPlain)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = toPlain(v)
    return out
  }
  return value
}

type Rec = Record<string, unknown>

function rec(value: unknown, what: string): Rec {
  const plain = toPlain(value)
  if (!plain || typeof plain !== 'object' || Array.isArray(plain)) {
    throw new Error(`Unexpected ${what} response from contract.`)
  }
  return plain as Rec
}

const str = (v: unknown): string => {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'bigint') return v.toString()
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return ''
}
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str) : [])

const AGREEMENT_STATUSES: AgreementStatus[] = ['PENDING_ACCEPTANCE', 'ACTIVE', 'COMPLETED', 'CANCELLED']
const MILESTONE_STATUSES: MilestoneStatus[] = [
  'AWAITING_EVIDENCE',
  'EVIDENCE_SUBMITTED',
  'VERIFYING',
  'APPROVED',
  'REJECTED',
  'INCONCLUSIVE',
]
const OUTCOMES: Outcome[] = ['APPROVED', 'REJECTED', 'INCONCLUSIVE']

function oneOf<T extends string>(value: unknown, allowed: readonly T[], what: string): T {
  const s = str(value).toUpperCase()
  const hit = allowed.find((a) => a === s)
  if (!hit) throw new Error(`Unknown ${what} "${str(value)}" returned by contract.`)
  return hit
}

function parseMet(v: unknown): CriterionMet {
  if (v === true || v === false) return v
  const s = str(v).toLowerCase()
  if (s === 'true') return true
  if (s === 'false') return false
  return 'unclear'
}

export function parseAgreement(raw: unknown): Agreement {
  const r = rec(raw, 'agreement')
  return {
    id: num(r.id),
    client: str(r.client),
    freelancer: str(r.freelancer),
    title: str(r.title),
    description: str(r.description),
    status: oneOf(r.status, AGREEMENT_STATUSES, 'agreement status'),
    createdAt: num(r.created_at),
    acceptedAt: num(r.accepted_at),
    milestoneCount: num(r.milestone_count),
  }
}

export function parseMilestone(raw: unknown): Milestone {
  const r = rec(raw, 'milestone')
  const submissions: Submission[] = (Array.isArray(r.submissions) ? r.submissions : []).map((s) => {
    const x = s as Rec
    return {
      url: str(x.url),
      commitSha: str(x.commit_sha),
      submittedBy: str(x.submitted_by),
      submittedAt: num(x.submitted_at),
      round: num(x.round),
    }
  })
  return {
    index: num(r.index),
    title: str(r.title),
    criteria: strList(r.criteria),
    status: oneOf(r.status, MILESTONE_STATUSES, 'milestone status'),
    submissions,
    roundsUsed: num(r.rounds_used),
    maxRounds: num(r.max_rounds),
    verifiedRounds: num(r.verified_rounds),
  }
}

export function parseVerification(raw: unknown): Verification {
  const r = rec(raw, 'verification')
  const results: CriterionResult[] = (Array.isArray(r.criteria_results) ? r.criteria_results : []).map(
    (c) => {
      const x = c as Rec
      return { criterionIndex: num(x.criterion_index), met: parseMet(x.met), reason: str(x.reason) }
    },
  )
  return {
    round: num(r.round),
    outcome: oneOf(r.outcome, OUTCOMES, 'outcome'),
    summary: str(r.summary),
    criteriaResults: results,
    evidenceUrl: str(r.evidence_url),
    evidenceCommitSha: str(r.evidence_commit_sha),
    requestedBy: str(r.requested_by),
    requestedAt: num(r.requested_at),
    finalizedAt: num(r.finalized_at),
  }
}

export function parseIdList(raw: unknown): number[] {
  const plain = toPlain(raw)
  return Array.isArray(plain) ? plain.map(num) : []
}

export function parseCount(raw: unknown): number {
  return num(toPlain(raw))
}
