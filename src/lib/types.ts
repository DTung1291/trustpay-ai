export type AgreementStatus = 'PENDING_ACCEPTANCE' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export type MilestoneStatus =
  | 'AWAITING_EVIDENCE'
  | 'EVIDENCE_SUBMITTED'
  | 'VERIFYING'
  | 'APPROVED'
  | 'REJECTED'
  | 'INCONCLUSIVE'

export type Outcome = 'APPROVED' | 'REJECTED' | 'INCONCLUSIVE'

export type CriterionMet = boolean | 'unclear'

export interface Agreement {
  id: number
  client: string
  freelancer: string
  title: string
  description: string
  status: AgreementStatus
  createdAt: number
  acceptedAt: number
  milestoneCount: number
}

export interface Submission {
  url: string
  commitSha: string
  submittedBy: string
  submittedAt: number
  round: number
}

export interface Milestone {
  index: number
  title: string
  criteria: string[]
  status: MilestoneStatus
  submissions: Submission[]
  roundsUsed: number
  maxRounds: number
  verifiedRounds: number
}

export interface CriterionResult {
  criterionIndex: number
  met: CriterionMet
  reason: string
}

export interface Verification {
  round: number
  outcome: Outcome
  summary: string
  criteriaResults: CriterionResult[]
  evidenceUrl: string
  evidenceCommitSha: string
  requestedBy: string
  requestedAt: number
  finalizedAt: number
}

export interface MilestoneDraft {
  title: string
  criteria: string[]
}

export interface AgreementBundle {
  agreement: Agreement
  milestones: Milestone[]
}
