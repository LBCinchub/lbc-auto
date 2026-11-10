// Owner/scanner request for LBC Auto AI. Every outcome returns a non-empty `reply`; failures that a
// read-only Retry can fix carry `retryable: true`. Diagnostics log codes only (no prompts or records).
import { handleStaffTurn } from './handler.ts';
import { ToolError, resolveStaffScope, shopIdentity } from './scope.ts';
import { withDeadline, replyText } from './deadline.ts';

export const LLM_MS = 25000;
const RETRYABLE = new Set(['timeout', 'rate_limited', 'unavailable', 'empty_reply']);
const UNAVAILABLE = 'LBC Auto AI Is Unavailable Right Now. Nothing Was Changed. Tap Retry.';

export const OWNER_SYSTEM = `You are LBC Auto AI, the shop's built-in assistant. You help shop owners and technicians with: labor hours, OBD codes, parts costs, repair diagnosis, maintenance intervals, and image analysis. Be direct and specific with numbers.

You are a professional shop management tool. NEVER offer appointment booking — shop owners are the ones running the shop, not booking into it.

Labor hours: no licensed labor guide is connected, so never present hours as book time or as verified. The ranges below are rough typical ranges; label any hours you give as "Rough Guidance (Not Book Time)".
Rough ranges: Oil change 0.3–0.5h | Brakes/axle 1.0–1.5h | CV axle 1.5–2.5h | Control arm 1.5–3.0h | Wheel bearing 1.5–3.0h | Strut 1.5–2.5h | Spark plugs 4cyl 0.5–1.5h | V6 1.5–3.0h | Head gasket 6–16h | Water pump 2–5h | Timing belt 3–6h | Alternator 1.5–3h | Cat converter 1.5–3h | O2 sensor 0.5–1.5h | Fuel pump 1.5–4h | AC compressor 2–4h | Radiator 2–4h | Transmission R&R 6–15h

Rust multipliers: Clean 1.0x | Light 1.2x | Moderate 1.4x | Heavy 1.8x | Severe 2.5x

Image analysis rules:
- Describe exactly what you see first
- Identify the automotive issue (wear, damage, leak, rust, DTC code on screen)
- Give specific repair recommendation with rough labor hours (labelled rough guidance), and cost at the shop labor rate from Shop Settings (if no rate is set, give hours only and say the rate is not set)
- If you see DTC codes: read every code and diagnose each one
- Tires: assess tread wear, depth, recommend action
- Brakes: pad thickness, rotor condition
- Engine bay: leaks, worn belts, corrosion

Reply style (presentation only — never overrides the rules above):
- Casual questions: answer in short, natural prose. Do not force numbered lists.
- Use bullets or numbered steps only for real procedures, multi-item comparisons, or estimates.
- Estimates: keep the short numbered format with exact prices, hours, tax and totals.
- Emojis: 0–2 relevant ones in casual chat only when natural. None in estimate text, money totals, or serious/safety topics.
- Never output internal markers, debug text, or made-up citations.`;

const ok = (json: any) => ({ status: 200, json });
const fail = (code: string, reply: string, extra: any = {}) => ok({ reply, error_code: code, retryable: RETRYABLE.has(code), ...extra });

export async function handleOwnerRequest({ base44, body, messages, mode, now = Date.now(), llmMs = LLM_MS }: any) {
  const user = await Promise.resolve().then(() => base44.auth.me()).catch(() => null);
  if (!user) return { status: 401, json: { reply: 'Sign In Again To Use LBC Auto AI.', error_code: 'unauthorized', retryable: false } };
  const llm = (p: any) => withDeadline(Promise.resolve().then(() => base44.integrations.Core.InvokeLLM(p)), llmMs);
  let shop: any = null;
  try {
    // Active shop = a verified membership of THIS session (re-checked on every call).
    // A shop_key the session does not hold fails closed; client shop claims are ignored.
    try { shop = shopIdentity(resolveStaffScope(user, now, { shop_key: body.shop_key })); }
    catch (e: any) {
      if (e instanceof ToolError && (e.code === 'shop_mismatch' || e.code === 'shop_ambiguous' || e.code === 'unauthorized')) {
        return ok({ reply: e.message, shop: null, error_code: e.code, retryable: false, staff: { error_code: e.code, tool_results: [] } });
      }
    }
    const { image_base64 = null, image_url = '', image_context = '', vehicle = '', description = '' } = body;
    // Staff tools: owner chat only (never scanner, never customer mode). Identity = this session.
    if (mode === 'owner' && !image_base64 && !image_url) {
      try {
        const staff = await handleStaffTurn({ userDb: base44.entities, svc: base44.asServiceRole.entities, user, body, llm, now });
        if (staff) return ok({ ...staff, shop, offer_appointment: false });
      } catch (e: any) {
        if (e instanceof ToolError) return fail(e.code, e.message, { shop, staff: { error_code: e.code, tool_results: [] } });
        throw e;
      }
    }
    let sys = OWNER_SYSTEM + '\n\nThis reply is general advice: it does not use or change this shop\'s records. Never state shop counts, balances or customer details. If asked for shop records, say to ask directly (e.g. "show unpaid invoices").';
    const shopInfo: string[] = [];
    if (user.business_name) shopInfo.push('Shop: ' + user.business_name);
    if (user.labor_rate != null) shopInfo.push('Labor rate: $' + user.labor_rate + '/hr');
    if (user.tax_rate != null) shopInfo.push('Tax rate: ' + user.tax_rate + '%');
    if (shopInfo.length) sys += '\n\nShop Settings:\n- ' + shopInfo.join('\n- ');
    if (vehicle) sys += '\nVehicle: ' + String(vehicle).slice(0, 120);
    if (description) sys += '\nJob: ' + String(description).slice(0, 300);
    const recent = messages.filter((m: any) => m.role !== 'system').slice(-6);
    let prompt = sys + '\n\nConversation:\n' + recent.map((m: any) => (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content).join('\n') + '\n\nRespond to the latest message as LBC Auto AI. Be concise.';
    const params: any = { prompt };
    const imageFile = image_url || image_base64;
    if (imageFile) {
      params.file_urls = [imageFile];
      params.prompt = prompt + '\n\nThe user has attached a photo for analysis. ' + (image_context || 'Analyze the image and describe what you see.') +
        ' Describe what you see clearly, identify any automotive issues, and provide repair recommendations with rough labor hours (labelled rough guidance) and parts cost.';
    }
    const reply = replyText(await llm(params));
    if (!reply) return fail('empty_reply', 'LBC Auto AI Returned An Empty Answer. Nothing Was Changed. Tap Retry.', { shop });
    return ok({ reply, shop, offer_appointment: false });
  } catch (e: any) {
    if (e instanceof ToolError) return fail(e.code, e.message, { shop });
    console.error('lbcAutoAI owner error', e?.name || 'error');
    return fail('unavailable', UNAVAILABLE, { shop });
  }
}