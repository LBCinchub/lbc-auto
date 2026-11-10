// Server-bound, single-use, expiring confirmations. The browser holds only {action_id, token}; the
// parameters live server-side, so a client cannot alter what gets executed.
import { ToolError } from './scope.ts';

const TTL_MS = 10 * 60 * 1000;
export async function sha256(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
// Key-order-independent JSON so a stored object hashes the same after a database round trip.
export const stableJson = (v: any): string => Array.isArray(v) ? `[${v.map(stableJson).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableJson(v[k])}`).join(',')}}` : JSON.stringify(v ?? null);
const randomToken = () => [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, '0')).join('');

export async function createPending(store: any, { scope, cap, prepared, requestId, now = Date.now() }: any) {
  const token = randomToken();
  const params = prepared.params;
  const rec = await store.create({
    shop_owner_email: scope.tenant, actor_user_id: scope.userId, capability: cap.name, kind: cap.kind,
    target_entity: prepared.target?.entity || '', target_id: prepared.target?.id || '', target_version: prepared.target?.version || '',
    params, params_sha256: await sha256(stableJson(params)), token_hash: await sha256(token),
    status: 'pending', expires_at: new Date(now + TTL_MS).toISOString(), request_id: requestId || '',
  });
  return { action_id: rec.id, token, expires_at: rec.expires_at };
}

// Claims the action atomically. A repeat confirm of an executed action replays its saved receipt.
export async function claim(store: any, { scope, actionId, token, now = Date.now() }: any) {
  if (typeof actionId !== 'string' || typeof token !== 'string' || !actionId || token.length !== 64) throw new ToolError('invalid', 'This confirmation is not valid.', 400);
  const rec = await store.get(actionId).catch(() => null);
  if (!rec || rec.kind === 'turn') throw new ToolError('not_found', 'This confirmation was not found.', 404);
  if (rec.actor_user_id !== scope.userId || rec.shop_owner_email !== scope.tenant) throw new ToolError('forbidden', 'This confirmation belongs to someone else.', 403);
  if (rec.token_hash !== await sha256(token)) throw new ToolError('forbidden', 'This confirmation was altered.', 403);
  if (rec.status === 'executed') return { replay: true, rec };
  if (rec.status === 'executing') throw new ToolError('in_progress', 'This action is already being saved.', 409);
  if (rec.status !== 'pending') throw new ToolError('closed', `This confirmation is ${rec.status}. Ask again for a fresh preview.`, 409);
  if (Date.parse(rec.expires_at) < now) { await store.update(rec.id, { status: 'expired' }); throw new ToolError('expired', 'This confirmation expired. Ask again for a fresh preview.', 410); }
  if (await sha256(stableJson(rec.params)) !== rec.params_sha256) throw new ToolError('forbidden', 'This confirmation was altered.', 403);
  const res = await store.updateMany({ id: rec.id, status: 'pending' }, { $set: { status: 'executing' } });
  if (res?.updated !== 1) throw new ToolError('in_progress', 'This action is already being saved.', 409);
  return { replay: false, rec };
}

export const finish = (store: any, id: string, patch: any) => store.update(id, { ...patch, executed_at: new Date().toISOString() });

export async function cancel(store: any, { scope, actionId, token }: any) {
  const rec = await store.get(actionId).catch(() => null);
  if (!rec || rec.actor_user_id !== scope.userId || rec.shop_owner_email !== scope.tenant || rec.token_hash !== await sha256(String(token || ''))) throw new ToolError('forbidden', 'This confirmation was not found.', 403);
  if (rec.status !== 'pending') return { status: rec.status };
  await store.updateMany({ id: rec.id, status: 'pending' }, { $set: { status: 'cancelled' } });
  return { status: 'cancelled' };
}