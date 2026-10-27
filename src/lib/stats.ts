import type { AgreementBundle, Verification } from './types'

export interface DashboardStats {
  totalAgreements: number
  pendingVerification: number
  approvedMilestones: number
  rejectedMilestones: number
}

/** Derived only from contract data the account can see. */
export function computeStats(bundles: AgreementBundle[]): DashboardStats {
  let pending = 0
  let approved = 0
  let rejected = 0
  for (const { milestones } of bundles) {
    for (const m of milestones) {
      if (m.status === 'EVIDENCE_SUBMITTED' || m.status === 'VERIFYING') pending++
      if (m.status === 'APPROVED') approved++
      if (m.status === 'REJECTED') rejected++
    }
  }
  return {
    totalAgreements: bundles.length,
    pendingVerification: pending,
    approvedMilestones: approved,
    rejectedMilestones: rejected,
  }
}

export interface ActivityItem {
  at: number
  kind: 'created' | 'accepted' | 'submitted'
  agreementId: number
  agreementTitle: string
  detail: string
}

export function buildActivity(bundles: AgreementBundle[]): ActivityItem[] {
  const items: ActivityItem[] = []
  for (const { agreement, milestones } of bundles) {
    if (agreement.createdAt)
      items.push({
        at: agreement.createdAt,
        kind: 'created',
        agreementId: agreement.id,
        agreementTitle: agreement.title,
        detail: 'Agreement created',
      })
    if (agreement.acceptedAt)
      items.push({
        at: agreement.acceptedAt,
        kind: 'accepted',
        agreementId: agreement.id,
        agreementTitle: agreement.title,
        detail: 'Freelancer accepted',
      })
    for (const m of milestones) {
      for (const s of m.submissions) {
        items.push({
          at: s.submittedAt,
          kind: 'submitted',
          agreementId: agreement.id,
          agreementTitle: agreement.title,
          detail: `Evidence submitted for "${m.title}"`,
        })
      }
    }
  }
  return items.sort((a, b) => b.at - a.at).slice(0, 8)
}

export function latestVerification(history: Verification[]): Verification | undefined {
  return history.length ? history[history.length - 1] : undefined
}

export function formatTimestamp(seconds: number): string {
  if (!seconds) return 'Not recorded'
  return new Date(seconds * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
