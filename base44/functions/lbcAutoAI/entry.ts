import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { handleStaffTurn } from '../../shared/staffAssistant/handler.ts';
import { ToolError, resolveStaffScope, shopIdentity } from '../../shared/staffAssistant/scope.ts';
import { publicReply } from '../../shared/publicAssistant.ts';

const OWNER_SYSTEM = `You are LBC Auto AI, the shop's built-in assistant. You help shop owners and technicians with: labor hours, OBD codes, parts costs, repair diagnosis, maintenance intervals, and image analysis. Be direct and specific with numbers.

You are a professional shop management tool. NEVER offer appointment booking — shop owners are the ones running the shop, not booking into it.

Labor hours: Oil change 0.3–0.5h | Brakes/axle 1.0–1.5h | CV axle 1.5–2.5h | Control arm 1.5–3.0h | Wheel bearing 1.5–3.0h | Strut 1.5–2.5h | Spark plugs 4cyl 0.5–1.5h | V6 1.5–3.0h | Head gasket 6–16h | Water pump 2–5h | Timing belt 3–6h | Alternator 1.5–3h | Cat converter 1.5–3h | O2 sensor 0.5–1.5h | Fuel pump 1.5–4h | AC compressor 2–4h | Radiator 2–4h | Transmission R&R 6–15h

Rust multipliers: Clean 1.0x | Light 1.2x | Moderate 1.4x | Heavy 1.8x | Severe 2.5x

Image analysis rules:
- Describe exactly what you see first
- Identify the automotive issue (wear, damage, leak, rust, DTC code on screen)
- Give specific repair recommendation with labor hours, and cost at the shop labor rate from Shop Settings (if no rate is set, give hours only and say the rate is not set)
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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    let messages: any[] = body.messages || [];
    if (!messages.length && body.message) messages = [{ role: 'user', content: body.message }];

    const {
      mode = 'customer',
      vehicle = '',
      description = '',
      image_base64 = null,
      image_url = '',
      image_context = '',
    } = body;

    if (!messages.length && !image_base64 && !image_url && !body.staff_action) {
      return Response.json({ reply: 'How can I help you today?' }, { headers: CORS_HEADERS });
    }

    const isOwner = mode === 'owner' || mode === 'scanner';

    // ════════════════════════════════════════════════════════════
    // OWNER / SCANNER MODE — auth required, full shop data injected
    // ════════════════════════════════════════════════════════════
    if (isOwner) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ reply: 'Authentication required.' }, { status: 401, headers: CORS_HEADERS });

      // Active shop = a verified membership of THIS session (re-checked on every call).
      // A shop_key the session does not hold fails closed; client shop claims are ignored.
      let shop: any = null;
      try { shop = shopIdentity(resolveStaffScope(user, Date.now(), { shop_key: body.shop_key })); }
      catch (e: any) {
        if (e instanceof ToolError && (e.code === 'shop_mismatch' || e.code === 'shop_ambiguous' || e.code === 'unauthorized')) {
          return Response.json({ reply: e.message, shop: null, staff: { error_code: e.code, tool_results: [] } }, { headers: CORS_HEADERS });
        }
      }

      // Staff tools: owner chat only (never scanner, never customer mode). Identity = this session.
      if (mode === 'owner' && !image_base64 && !image_url) {
        try {
          const staff = await handleStaffTurn({
            userDb: base44.entities, svc: base44.asServiceRole.entities, user, body,
            llm: (p: any) => base44.integrations.Core.InvokeLLM(p),
          });
          if (staff) return Response.json({ ...staff, shop, offer_appointment: false }, { headers: CORS_HEADERS });
        } catch (e: any) {
          if (e instanceof ToolError) return Response.json({ reply: e.message, shop, staff: { error_code: e.code, tool_results: [] } }, { headers: CORS_HEADERS });
          throw e;
        }
      }

      let sys = OWNER_SYSTEM + '\n\nThis reply is general advice: it does not use or change this shop\'s records. Never state shop counts, balances or customer details. If asked for shop records, say to ask directly (e.g. "show unpaid invoices").';

      // Shop settings from the verified session user only
      const shopInfo: string[] = [];
      if (user.business_name) shopInfo.push('Shop: ' + user.business_name);
      if (user.labor_rate != null) shopInfo.push('Labor rate: $' + user.labor_rate + '/hr');
      if (user.tax_rate != null) shopInfo.push('Tax rate: ' + user.tax_rate + '%');
      if (shopInfo.length) sys += '\n\nShop Settings:\n- ' + shopInfo.join('\n- ');
      if (vehicle) sys += '\nVehicle: ' + String(vehicle).slice(0, 120);
      if (description) sys += '\nJob: ' + String(description).slice(0, 300);

      // Build conversation prompt
      const recent = messages.filter((m: any) => m.role !== 'system').slice(-6);
      let prompt = sys + '\n\nConversation:\n' +
        recent.map((m: any) => (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content).join('\n') +
        '\n\nRespond to the latest message as LBC Auto AI. Be concise.';

      const llmParams: any = { prompt };
      const imageFile = image_url || image_base64;
      if (imageFile) {
        llmParams.file_urls = [imageFile];
        prompt += '\n\nThe user has attached a photo for analysis. ' +
          (image_context || 'Analyze the image and describe what you see.') +
          ' Describe what you see clearly, identify any automotive issues, and provide repair recommendations with estimated labor hours and parts cost.';
        llmParams.prompt = prompt;
      }

      const result = await base44.integrations.Core.InvokeLLM(llmParams);
      let reply =
        (typeof result === 'string' ? result : null) ||
        result?.reply ||
        result?.content ||
        result?.message ||
        'No response generated.';

      reply = reply.replace(/\[OFFER_APT\]/g, '').trim();
      return Response.json({ reply, shop, offer_appointment: false }, { headers: CORS_HEADERS });
    }

    // ════════════════════════════════════════════════════════════
    // PUBLIC MODE — no login. Shop resolved only from a verified booking alias or website key;
    // no default shop. Only explicitly public shop facts reach the model.
    // ════════════════════════════════════════════════════════════
    const sr = base44.asServiceRole;
    const out = await publicReply({ entities: sr.entities, llm: (p: any) => sr.integrations.Core.InvokeLLM(p), body, messages });
    return Response.json({ reply: out.reply, offer_appointment: out.offer_appointment, ...(out.blocked ? { error_code: out.blocked } : {}) }, { headers: CORS_HEADERS });

  } catch (err: any) {
    console.error('lbcAutoAI error:', err?.message);
    return Response.json(
      { reply: 'AI temporarily unavailable. Please call your shop directly.' },
      { status: 200, headers: CORS_HEADERS }
    );
  }
});