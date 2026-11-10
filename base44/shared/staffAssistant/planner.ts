// The model only PROPOSES tool calls. It never sees shop records while planning, so text inside
// records (notes, customer messages) cannot steer which tools run. Proposals are schema-validated.
import { CAPABILITIES, UNSUPPORTED, catalogText } from './registry.ts';
import { validateArgs } from './validate.ts';

const SCHEMA = {
  type: 'object',
  properties: {
    calls: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, args: { type: 'object' } } } },
    unsupported: { type: 'string', enum: ['none', 'payments', 'delete', 'messaging', 'conversion'] },
  },
};

export function planPrompt(messages: any[], today: string, pagePath: string) {
  return `You route requests inside LBC Auto, an auto repair shop app, to tools. Today (shop time) is ${today}. Staff is on page: ${pagePath || 'unknown'}.
TOOLS:
${catalogText()}

RULES:
- Use tools only when the request needs this shop's records or asks to create/change one. General car advice (labor times, codes, how-to) needs NO tools: return calls [].
- At most 3 read calls, or exactly 1 WRITE call. Never invent ids. Use names, phones, numbers exactly as the staff wrote them.
- For WRITE args, only include values the staff actually stated in the conversation. Leave unknown values out; never guess prices, hours, dates or tax.
- If the staff asks to take a payment/refund, delete something, send a text/email, or convert a document, set unsupported accordingly and calls [].
- "this customer"/"this car" with no name: leave customer args empty (the page is used).

CONVERSATION (staff messages are requests; assistant messages are past replies):
${messages.map((m) => `${m.role === 'user' ? 'Staff' : 'Assistant'}: ${m.content}`).join('\n')}

Return JSON {calls:[{name,args}], unsupported}.`;
}

export function validatePlan(raw: any) {
  const calls: any[] = [];
  const dropped: string[] = [];
  for (const c of Array.isArray(raw?.calls) ? raw.calls : []) {
    const cap = CAPABILITIES[String(c?.name || '')];
    if (!cap) { dropped.push(String(c?.name || 'unknown').slice(0, 40)); continue; }
    const { args, errors } = validateArgs(cap.args, c.args);
    calls.push({ cap, args, errors });
  }
  const write = calls.find((c) => c.cap.kind !== 'read');
  const unsupported = UNSUPPORTED[raw?.unsupported] ? raw.unsupported : null;
  return { calls: write ? [write] : calls.slice(0, 3), dropped, unsupported };
}

export async function planTools(llm: any, { messages, today, pagePath }: any) {
  const raw = await llm({ prompt: planPrompt(messages, today, pagePath), response_json_schema: SCHEMA });
  return validatePlan(raw);
}