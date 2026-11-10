// Capability registry. Only names listed here can ever run; everything else is reported as unsupported.
import { READS } from './reads.ts';
import { MORE_READS } from './readsMore.ts';
import { WRITES } from './writes.ts';
import { specText } from './validate.ts';
import { rolesFor } from './policy.ts';

export const CAPABILITIES: Record<string, any> = Object.fromEntries([...READS, ...MORE_READS, ...WRITES].map((c) => {
  const cap = { kind: 'read', ...c };
  return [c.name, { ...cap, roles: rolesFor(cap) }];
}));

// Asked for, deliberately not offered from chat (money movement, deletion, outbound messages).
export const UNSUPPORTED: Record<string, string> = {
  payments: 'Recording payments, refunds and card charges stay in the invoice screen so money is never moved from chat.',
  delete: 'Deleting records is not available from chat. Open the record to delete it.',
  messaging: 'Sending texts or emails to customers is not available from chat. Use the Send buttons on the document.',
  conversion: 'Converting estimates to repair orders or invoices stays on the estimate page.',
};

// The planner only sees the tools the staff member's role may use.
export const catalogText = (role = 'owner') => Object.values(CAPABILITIES)
  .filter((c: any) => c.roles.includes(role))
  .map((c: any) => `- ${c.name} [${c.kind === 'read' ? 'read' : 'WRITE'}]: ${c.description} Args: ${specText(c.args) || 'none'}`).join('\n');