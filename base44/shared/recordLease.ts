// Durable per-record lease built on the platform's documented atomic single-record
// conditional update: updateMany({ id, <condition> }, ...) is re-checked at write time,
// so when two requests race only one gets `updated === 1`.
// The lease is stored on the record itself, so it survives process crashes and expires by TTL.
const EPOCH = '1970-01-01T00:00:00.000Z';

export class LeaseBusyError extends Error {
  constructor(message = 'Another request is already processing this record. Please retry in a moment.') { super(message); this.name = 'LeaseBusyError'; }
}

export async function acquireLease(entities: any, entity: string, id: string, owner: string, ttlMs = 60000, now = () => Date.now()) {
  const set = { $set: { financial_lease_until: new Date(now() + ttlMs).toISOString(), financial_lease_owner: owner } };
  // A never-leased record may hold the field as explicit null (not just missing); `null`
  // matches both, while `$exists: false` skips explicit nulls and left such records unlockable.
  const fresh = await entities[entity].updateMany({ id, financial_lease_until: null }, set);
  if (fresh?.updated === 1) return true;
  const expired = await entities[entity].updateMany({ id, financial_lease_until: { $lt: new Date(now()).toISOString() } }, set);
  return expired?.updated === 1;
}

export async function releaseLease(entities: any, entity: string, id: string, owner: string) {
  await entities[entity].updateMany({ id, financial_lease_owner: owner }, { $set: { financial_lease_until: EPOCH } });
}

// Runs fn while holding the lease. Waits briefly for a competing holder, then fails closed (409).
export async function withLease(entities: any, entity: string, id: string, fn: () => Promise<any>, { attempts = 20, delayMs = 250, ttlMs = 60000, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const owner = crypto.randomUUID();
  for (let i = 0; i < attempts; i++) {
    if (await acquireLease(entities, entity, id, owner, ttlMs)) {
      try { return await fn(); } finally { await releaseLease(entities, entity, id, owner).catch(() => {}); }
    }
    await sleep(delayMs);
  }
  throw new LeaseBusyError();
}