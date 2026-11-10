// The model only PROPOSES tool calls. It never sees shop records while planning, so text inside
// records (notes, customer messages) cannot steer which tools run. Proposals are schema-validated.
import { CAPABILITIES, UNSUPPORTED, catalogText } from './registry.ts';
import { validateArgs } from './validate.ts';
import { planSchema as schemaFor, callArgs } from './planArgs.ts';

// Only the tools this role may use are offered, and their names/keys are the schema allowlist.
export const planSchema = (role = 'owner') => schemaFor(Object.values(CAPABILITIES).filter((c: any) => c.roles.includes(role)));

export function planPrompt(messages: any[], today: string, pagePath: string, role = 'owner') {
  return `You route requests inside LBC Auto, an auto repair shop app, to tools. Today (shop time) is ${today}. Staff is on page: ${pagePath || 'unknown'}.
TOOLS:
${catalogText(role)}

RULES:
- Use tools only when the request needs this shop's records or asks to create/change one. General car advice (codes, how-to) needs NO tools: return calls [].
- Repair labor time ("labor hours", "book time", "how long to replace X") is answered elsewhere: never use estimates.create, price_library.search or time.summary for it. time.summary is employee clock time only, never repair labor hours.
- Use estimates.create ONLY when the staff explicitly asks to create, make or write an estimate.
- At most 3 read calls, or exactly 1 WRITE call. Never invent ids. Use names, phones, numbers exactly as the staff wrote them.
- For WRITE args, only include values the staff actually stated in the conversation. Leave unknown values out; never guess prices, hours, dates or tax.
- If the staff asks to take a payment/refund, delete something, send a text/email, or convert a document, set unsupported accordingly and calls [].
- "this customer"/"this car" with no name: leave customer args empty (the page is used).
- Give each call's args as a list of {key, value} pairs, value as text. Include ONLY keys the staff stated (or the rules above require); leave everything else out. Estimate lines go in "lines" (quantity and unit_price as text, "" when not stated).
- Search words go in the query pair as plain text, e.g. "price lib brake" -> price_library.search args [{key:"query",value:"brake"}]; add a type pair (labor or part) only when the staff said labor/labour or part. If no item is named, leave query out.

CONVERSATION (staff messages are requests; assistant messages are past replies):
${messages.map((m) => `${m.role === 'user' ? 'Staff' : 'Assistant'}: ${m.content}`).join('\n')}

Return JSON {calls:[{name, args:[{key,value}], lines}], unsupported}.`;
}

export function validatePlan(raw: any) {
  const calls: any[] = [];
  const dropped: string[] = [];
  for (const c of Array.isArray(raw?.calls) ? raw.calls : []) {
    const cap = CAPABILITIES[String(c?.name || '')];
    if (!cap) { dropped.push(String(c?.name || 'unknown').slice(0, 40)); continue; }
    const { args, errors } = validateArgs(cap.args, callArgs(cap.args, c));
    calls.push({ cap, args, errors });
  }
  const write = calls.find((c) => c.cap.kind !== 'read');
  const unsupported = UNSUPPORTED[raw?.unsupported] ? raw.unsupported : null;
  return { calls: write ? [write] : calls.slice(0, 3), dropped, unsupported };
}

export async function planTools(llm: any, { messages, today, pagePath, role }: any) {
  const raw = await llm({ prompt: planPrompt(messages, today, pagePath, role), response_json_schema: planSchema(role) });
  return validatePlan(raw);
}