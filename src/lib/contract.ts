import { TransactionHashVariant } from 'genlayer-js/types'
import { getReadClient, getWriteClient } from './genlayer'
import {
  parseAgreement,
  parseCount,
  parseIdList,
  parseMilestone,
  parseVerification,
} from './normalize'
import type { AgreementBundle, Milestone, Verification } from './types'

type Addr = `0x${string}`

async function read(address: string, functionName: string, args: (string | number | bigint)[] = []) {
  return getReadClient().readContract({
    address: address as Addr,
    functionName,
    args,
    // Show the newest accepted state. Finality is reported separately by the tx tracker.
    transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL,
  })
}

// ---- Reads ---------------------------------------------------------------

export async function getAgreementCount(contract: string): Promise<number> {
  return parseCount(await read(contract, 'get_agreement_count'))
}

/** Confirm an address answers the interface the app needs. Returns the agreement count. */
export async function probeContract(contract: string): Promise<number> {
  try {
    return await getAgreementCount(contract)
  } catch {
    throw new Error(
      'This address did not answer get_agreement_count on Studionet. Check that the contract is deployed there and implements docs/frontend-contract-interface.md.',
    )
  }
}

export async function getAgreementIdsFor(contract: string, account: string): Promise<number[]> {
  return parseIdList(await read(contract, 'get_agreement_ids_for', [account]))
}

export async function getAgreement(contract: string, id: number) {
  return parseAgreement(await read(contract, 'get_agreement', [BigInt(id)]))
}

export async function getMilestone(contract: string, id: number, index: number): Promise<Milestone> {
  return parseMilestone(await read(contract, 'get_milestone', [BigInt(id), BigInt(index)]))
}

export async function getVerification(
  contract: string,
  id: number,
  index: number,
  round: number,
): Promise<Verification> {
  return parseVerification(
    await read(contract, 'get_verification', [BigInt(id), BigInt(index), BigInt(round)]),
  )
}

export async function getAgreementBundle(contract: string, id: number): Promise<AgreementBundle> {
  const agreement = await getAgreement(contract, id)
  const milestones = await Promise.all(
    Array.from({ length: agreement.milestoneCount }, (_, i) => getMilestone(contract, id, i)),
  )
  return { agreement, milestones }
}

export async function getVerificationHistory(
  contract: string,
  id: number,
  milestone: Milestone,
): Promise<Verification[]> {
  const rounds = Array.from({ length: milestone.verifiedRounds }, (_, i) => i + 1)
  return Promise.all(rounds.map((r) => getVerification(contract, id, milestone.index, r)))
}

/** Every agreement the account takes part in, with milestones. Failures are surfaced, not hidden. */
export async function getBundlesFor(contract: string, account: string): Promise<AgreementBundle[]> {
  const ids = await getAgreementIdsFor(contract, account)
  const bundles = await Promise.all(ids.map((id) => getAgreementBundle(contract, id)))
  return bundles.sort((a, b) => b.agreement.id - a.agreement.id)
}

// ---- Writes (return the transaction hash; tracking happens in tx.ts) ----------

async function write(
  contract: string,
  sender: string,
  functionName: string,
  args: (string | number | bigint)[],
): Promise<string> {
  const client = getWriteClient(sender)
  const hash: unknown = await client.writeContract({
    address: contract as Addr,
    functionName,
    args,
    value: 0n,
  })
  if (typeof hash !== 'string') throw new Error('The wallet did not return a transaction hash.')
  return hash
}

export const sendCreateAgreement = (
  contract: string,
  sender: string,
  p: { title: string; description: string; freelancer: string; milestonesJson: string },
) =>
  write(contract, sender, 'create_agreement', [
    p.title.trim(),
    p.description.trim(),
    p.freelancer.trim(),
    p.milestonesJson,
  ])

export const sendAcceptAgreement = (contract: string, sender: string, id: number) =>
  write(contract, sender, 'accept_agreement', [BigInt(id)])

export const sendSubmitDeliverable = (
  contract: string,
  sender: string,
  p: { id: number; index: number; url: string; commitSha: string },
) =>
  write(contract, sender, 'submit_deliverable', [
    BigInt(p.id),
    BigInt(p.index),
    p.url.trim(),
    p.commitSha.trim(),
  ])

export const sendRequestVerification = (contract: string, sender: string, id: number, index: number) =>
  write(contract, sender, 'request_verification', [BigInt(id), BigInt(index)])
