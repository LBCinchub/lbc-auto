import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { handleOwnerRequest } from '../../shared/staffAssistant/ownerRequest.ts';
import { publicReply } from '../../shared/publicAssistant.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const body = await req.json().catch(() => ({}));
  const mode = body.mode || 'customer';
  const isOwner = mode === 'owner' || mode === 'scanner';
  try {
    const base44 = createClientFromRequest(req);

    let messages: any[] = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length && body.message) messages = [{ role: 'user', content: body.message }];

    if (!messages.length && !body.image_base64 && !body.image_url && !body.staff_action) {
      return Response.json({ reply: 'How can I help you today?' }, { headers: CORS_HEADERS });
    }

    // ════════════════════════════════════════════════════════════
    // OWNER / SCANNER MODE — verified session; staff tools (owner chat only) via handleStaffTurn
    // in the shared owner request. Always returns a visible reply.
    // ════════════════════════════════════════════════════════════
    if (isOwner) {
      const out = await handleOwnerRequest({ base44, body, messages, mode });
      return Response.json(out.json, { status: out.status, headers: CORS_HEADERS });
    }

    // ════════════════════════════════════════════════════════════
    // PUBLIC MODE — no login. Shop resolved only from a verified booking alias or website key;
    // no default shop. Only explicitly public shop facts reach the model.
    // ════════════════════════════════════════════════════════════
    const sr = base44.asServiceRole;
    const out = await publicReply({ entities: sr.entities, llm: (p: any) => sr.integrations.Core.InvokeLLM(p), body, messages });
    return Response.json({ reply: out.reply, offer_appointment: out.offer_appointment, ...(out.blocked ? { error_code: out.blocked } : {}) }, { headers: CORS_HEADERS });

  } catch (err: any) {
    console.error('lbcAutoAI error:', err?.name || 'error');
    const reply = isOwner ? 'LBC Auto AI Is Unavailable Right Now. Nothing Was Changed. Tap Retry.' : 'AI temporarily unavailable. Please call your shop directly.';
    return Response.json({ reply, error_code: 'unavailable', retryable: isOwner }, { status: 200, headers: CORS_HEADERS });
  }
});