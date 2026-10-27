import { describe, expect, test } from 'bun:test'
import { parseAgreement, parseMilestone, parseVerification, toPlain } from '../../src/lib/normalize'
import { buildActivity, computeStats } from '../../src/lib/stats'
import { classifyTx, trackTransaction, type RawTx } from '../../src/lib/tx'
import {
  isGithubEvidence,
  serializeMilestones,
  validateAgreementForm,
  validateCommitSha,
  validateEvidenceUrl,
} from '../../src/lib/validation'
import type { AgreementBundle } from '../../src/lib/types'

const CLIENT = '0x1111111111111111111111111111111111111111'
const FREELANCER = '0x2222222222222222222222222222222222222222'

describe('evidence validation', () => {
  test('accepts public https URLs', () => {
    expect(validateEvidenceUrl('https://github.com/org/repo/pull/1')).toBeNull()
  })
  test.each([
    ['', 'required'],
    ['http://github.com/a/b', 'https'],
    ['https://user:pw@github.com/a/b', 'credentials'],
    ['https://github.com/a b', 'spaces'],
    ['https://localhost/x', 'host'],
    ['javascript:alert(1)', 'https'],
  ])('rejects %s', (input) => {
    expect(validateEvidenceUrl(input)).not.toBeNull()
  })
  test('commit sha is optional but strict when present', () => {
    expect(validateCommitSha('')).toBeNull()
    expect(validateCommitSha('a1b2c3d')).toBeNull()
    expect(validateCommitSha('xyz')).not.toBeNull()
    expect(validateCommitSha('a'.repeat(41))).not.toBeNull()
  })
  test('detects github hosts', () => {
    expect(isGithubEvidence('https://github.com/a/b')).toBe(true)
    expect(isGithubEvidence('https://github.com.evil.io/a')).toBe(false)
  })
})

describe('agreement form validation', () => {
  const base = {
    title: 'Site',
    description: 'Build it',
    freelancer: FREELANCER,
    milestones: [{ title: 'M1', criteria: ['Has README'] }],
  }
  test('valid input passes', () => {
    expect(validateAgreementForm(base, CLIENT)).toBeNull()
  })
  test('freelancer cannot be the client', () => {
    expect(validateAgreementForm({ ...base, freelancer: CLIENT }, CLIENT)).not.toBeNull()
  })
  test('needs a criterion per milestone', () => {
    expect(validateAgreementForm({ ...base, milestones: [{ title: 'M1', criteria: ['  '] }] }, CLIENT)).not.toBeNull()
  })
  test('serializes trimmed milestones as JSON', () => {
    const json = serializeMilestones([{ title: ' M1 ', criteria: [' a ', ''] }])
    expect(JSON.parse(json)).toEqual([{ title: 'M1', criteria: ['a'] }])
  })
})

describe('contract response normalization', () => {
  test('converts Map and bigint values', () => {
    const plain = toPlain(new Map<string, unknown>([['n', 5n], ['list', [new Map([['a', 1n]])]]]))
    expect(plain).toEqual({ n: 5, list: [{ a: 1 }] })
  })
  test('parses an agreement and rejects unknown statuses', () => {
    const raw = { id: 1, client: CLIENT, freelancer: FREELANCER, title: 't', description: 'd', status: 'ACTIVE', created_at: 10, accepted_at: 20, milestone_count: 2 }
    expect(parseAgreement(raw).milestoneCount).toBe(2)
    expect(() => parseAgreement({ ...raw, status: 'WEIRD' })).toThrow()
  })
  test('parses milestones and verifications', () => {
    const m = parseMilestone({ index: 0, title: 'M', criteria: ['a'], status: 'EVIDENCE_SUBMITTED', submissions: [{ url: 'https://x.io', commit_sha: '', submitted_by: FREELANCER, submitted_at: 1, round: 1 }], rounds_used: 1, max_rounds: 3, verified_rounds: 0 })
    expect(m.submissions[0].url).toBe('https://x.io')
    const v = parseVerification({ round: 1, outcome: 'REJECTED', summary: 's', criteria_results: [{ criterion_index: 0, met: 'false', reason: 'r' }, { criterion_index: 1, met: 'maybe', reason: '' }], evidence_url: 'u', evidence_commit_sha: '', requested_by: CLIENT, requested_at: 1, finalized_at: 2 })
    expect(v.criteriaResults.map((c) => c.met)).toEqual([false, 'unclear'])
  })
})

describe('transaction lifecycle', () => {
  test('classifies statuses honestly', () => {
    expect(classifyTx({ statusName: 'PENDING' }).phase).toBe('pending')
    expect(classifyTx({ statusName: 'COMMITTING' }).phase).toBe('consensus')
    expect(classifyTx({ statusName: 'ACCEPTED', txExecutionResultName: 'FINISHED_WITH_RETURN' }).phase).toBe('accepted')
    expect(classifyTx({ statusName: 'FINALIZED', txExecutionResultName: 'FINISHED_WITH_RETURN' })).toEqual({ phase: 'finalized', terminal: true })
  })
  test('contract errors and failed consensus are failures, never successes', () => {
    expect(classifyTx({ statusName: 'ACCEPTED', txExecutionResultName: 'FINISHED_WITH_ERROR' }).phase).toBe('failed')
    expect(classifyTx({ statusName: 'FINALIZED', txExecutionResultName: 'FINISHED_WITH_ERROR' }).phase).toBe('failed')
    expect(classifyTx({ statusName: 'UNDETERMINED' }).phase).toBe('failed')
    expect(classifyTx({ statusName: 'CANCELED' }).phase).toBe('failed')
  })
  test('tracker walks to finalization and reports each phase', async () => {
    const script: RawTx[] = [
      { statusName: 'PENDING' },
      { statusName: 'PROPOSING' },
      { statusName: 'ACCEPTED', txExecutionResultName: 'FINISHED_WITH_RETURN' },
      { statusName: 'FINALIZED', txExecutionResultName: 'FINISHED_WITH_RETURN' },
    ]
    let i = 0
    const seen: string[] = []
    const result = await trackTransaction('0xabc', {
      intervalMs: 1,
      fetchTx: async () => script[Math.min(i++, script.length - 1)],
      onUpdate: (u) => seen.push(u.phase),
    })
    expect(result).toBe('finalized')
    expect(seen).toEqual(['pending', 'consensus', 'accepted', 'finalized'])
  })
  test('tracker survives transient RPC errors', async () => {
    let calls = 0
    const result = await trackTransaction('0xabc', {
      intervalMs: 1,
      fetchTx: async () => {
        if (calls++ < 2) throw new Error('rpc down')
        return { statusName: 'FINALIZED', txExecutionResultName: 'FINISHED_WITH_RETURN' }
      },
      onUpdate: () => {},
    })
    expect(result).toBe('finalized')
  })
  test('tracker reports a timeout instead of success', async () => {
    const seen: { phase: string; error?: string }[] = []
    const result = await trackTransaction('0xabc', {
      intervalMs: 1,
      timeoutMs: 20,
      fetchTx: async () => ({ statusName: 'PENDING' }),
      onUpdate: (u) => seen.push(u),
    })
    expect(result).toBe('failed')
    expect(seen[seen.length - 1].error).toContain('Timed out')
  })
})

describe('dashboard statistics', () => {
  const bundle = (statuses: string[]): AgreementBundle => ({
    agreement: { id: 0, client: CLIENT, freelancer: FREELANCER, title: 'T', description: '', status: 'ACTIVE', createdAt: 5, acceptedAt: 6, milestoneCount: statuses.length },
    milestones: statuses.map((status, index) => ({ index, title: `M${index}`, criteria: ['c'], status: status as never, submissions: [], roundsUsed: 0, maxRounds: 3, verifiedRounds: 0 })),
  })
  test('counts only what the contract reports', () => {
    const stats = computeStats([bundle(['APPROVED', 'REJECTED', 'EVIDENCE_SUBMITTED', 'VERIFYING', 'AWAITING_EVIDENCE'])])
    expect(stats).toEqual({ totalAgreements: 1, pendingVerification: 2, approvedMilestones: 1, rejectedMilestones: 1 })
  })
  test('empty input yields zeros and no activity', () => {
    expect(computeStats([]).totalAgreements).toBe(0)
    expect(buildActivity([])).toEqual([])
  })
})
