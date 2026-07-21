import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SHOP_CONFIGS: Record<string, { name: string; phone: string; context: string }> = {
  'hajwheels@gmail.com': {
    name: 'Haj Rims & Tires',
    phone: '613-672-2727',
    context: `You are the AI assistant for Haj Rims & Tires, Gatineau/Ottawa area — a trusted local auto shop. You are part of their team.
PRICING (quote these exact numbers — no hedging):
- Oil change: $100 standard | $120 European/German/3.5L+ | $150 diesel/heavy
- Wheel alignment: $120 cars/SUVs | $160 trucks
- Brakes: $150 per end (NAPA pads + labour included)
- Labor: $120/hr
- Tire install & balance (set of 4): $120 standard | $160 trucks
- Control arm per side: ~$300–$420 (NAPA parts + alignment included)
- Inspection: $60 car | $80 SUV | $100 truck/German
- Spark plugs: $200 (labour + plugs)
- All parts: NAPA with Worldpac warranty
RULES:
- Max 3 sentences per reply
- Always end with: Call or text 📞 613-672-2727 to book
- Quote price IMMEDIATELY
- NEVER mention repair orders, invoices, shop finances, or internal data
- NEVER reveal discount logic or percentage math
- You ARE part of the Haj Rims & Tires team — speak as "we" and "our shop"
APPOINTMENT SCHEDULING:
- After answering any service question, naturally offer: "Would you like to schedule this at Haj Rims & Tires? We can get you in fast."
- When the user shows interest in booking, collect: preferred date/time, name, phone
- Confirm the booking warmly`
  },
  'belalautoservices@gmail.com': {
    name: 'Belal Auto Services', phone: '613-000-0000',
    context: `You are part of the Belal Auto Services team. Answer ONLY about car services. Labor: $120/hr. Max 3 sentences. After answering, offer: "Want to schedule this with us?" Always end: Call us to book. NEVER mention internal shop data.`
  },
  'aka.auto.group@gmail.com': {
    name: 'AKA Auto Group', phone: '613-000-0000',
    context: `You are part of the AKA Auto Group team. Answer ONLY about car services. Labor: $120/hr. Max 3 sentences. After answering, offer: "Want to schedule this with us?" Always end: Call us to book. NEVER mention internal shop data.`
  },
  'terryfoxauto@gmail.com': {
    name: 'Terry Fox Auto', phone: '613-000-0000',
    context: `You are part of the Terry Fox Auto team. Answer ONLY about car services. Labor: $120/hr. Max 3 sentences. After answering, offer: "Want to schedule this with us?" Always end: Call us to book. NEVER mention internal shop data.`
  }
};

const OWNER_SYSTEM = `You are LBC Auto AI, the shop's built-in assistant. You help with: labor hours, OBD codes, parts costs, repair diagnosis, maintenance intervals, and image analysis. Be direct and specific with numbers.

PARTNER SHOP — HAJ RIMS & TIRES (Gatineau/Ottawa):
You are fully integrated with Haj Rims & Tires as a partner shop. When a conversation reaches a natural conclusion — after diagnosing an issue, quoting a price, or answering a service question — ALWAYS offer to schedule an appointment at Haj Rims & Tires. Say something like: "Would you like me to schedule this at Haj Rims & Tires? 📅" This is a key part of your role.

Shop contact: 📞 613-672-2727 | hajwheels@gmail.com
Haj Rims pricing: Oil change $100/$120/$150 | Alignment $120/$160 trucks | Labor $120/hr | Brakes $150/end | Tires (set of 4) $120/$160 trucks | Parts: NAPA + Worldpac warranty

Labor hours: Oil change 0.3–0.5h | Brakes/axle 1.0–1.5h | CV axle 1.5–2.5h | Control arm 1.5–3.0h | Wheel bearing 1.5–3.0h | Strut 1.5–2.5h | Spark plugs 4cyl 0.5–1.5h | V6 1.5–3.0h | Head gasket 6–16h | Water pump 2–5h | Timing belt 3–6h | Alternator 1.5–3h | Cat converter 1.5–3h | O2 sensor 0.5–1.5h | Fuel pump 1.5–4h | AC compressor 2–4h | Radiator 2–4h | Transmission R&R 6–15h

Rust multipliers: Clean 1.0x | Light 1.2x | Moderate 1.4x | Heavy 1.8x | Severe 2.5x

Image analysis rules:
- Describe exactly what you see first
- Identify the automotive issue (wear, damage, leak, rust, DTC code on screen)
- Give specific repair recommendation with labor hours and cost in CAD at $120/hr
- If you see DTC codes: read every code and diagnose each one
- Tires: assess tread wear, depth, recommend action
- Brakes: pad thickness, rotor condition
- Engine bay: leaks, worn belts, corrosion

APPOINTMENT OFFER RULE: At the END of every response where you've diagnosed an issue, quoted a price, or completed a service explanation — append this JSON flag on a new line: [OFFER_APT]
This tells the frontend to show the "Schedule at Haj Rims" button. Only skip it if the user is already mid-booking or explicitly said no.`;

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
      shop_context = null,
      shop_email = 'hajwheels@gmail.com',
      image_base64 = null,
      image_url = '',
      image_context = '',
    } = body;

    if (!messages.length && !image_base64 && !image_url) {
      return Response.json({ reply: 'How can I help you today?' }, { headers: CORS_HEADERS });
    }

    const isOwner = mode === 'owner' || mode === 'scanner';

    // ════════════════════════════════════════════════════════════
    // OWNER / SCANNER MODE — auth required, full shop data injected
    // ════════════════════════════════════════════════════════════
    if (isOwner) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ reply: 'Authentication required.' }, { status: 401, headers: CORS_HEADERS });

      let sys = OWNER_SYSTEM;

      // Shop settings from user profile
      const shopInfo: string[] = [];
      if (user.business_name) shopInfo.push('Shop: ' + user.business_name);
      if (user.email) shopInfo.push('Email: ' + user.email);
      if (user.phone) shopInfo.push('Phone: ' + user.phone);
      if (user.address) shopInfo.push('Address: ' + user.address);
      if (user.labor_rate != null) shopInfo.push('Labor rate: $' + user.labor_rate + '/hr');
      if (user.tax_rate != null) shopInfo.push('Tax rate: ' + user.tax_rate + '%');
      if (shopInfo.length) sys += '\n\nShop Settings:\n- ' + shopInfo.join('\n- ');

      // Live shop data (user-scoped via RLS)
      const today = new Date().toISOString().slice(0, 10);
      const [repairOrders, invoices, parts, appointments] = await Promise.all([
        base44.entities.RepairOrder.filter({}).catch(() => []),
        base44.entities.Invoice.filter({}).catch(() => []),
        base44.entities.Part.filter({}).catch(() => []),
        base44.entities.Appointment.filter({ date: today }).catch(() => []),
      ]);

      const openROs = repairOrders.filter((r: any) => r.status !== 'completed' && r.status !== 'delivered');
      const unpaidInvoices = invoices.filter((i: any) => i.status === 'unpaid' || i.status === 'partial' || i.status === 'overdue');
      const totalOwed = unpaidInvoices.reduce((s: number, i: any) => s + (i.balance_due || (i.total || 0) - (i.amount_paid || 0)), 0);
      const lowStock = parts.filter((p: any) => p.quantity != null && p.min_stock != null && p.quantity <= p.min_stock);

      const dataLines: string[] = [];
      dataLines.push('Open repair orders: ' + openROs.length);
      if (openROs.length) {
        dataLines.push('- ' + openROs.slice(0, 5).map((r: any) =>
          `${r.order_number || 'RO'}: ${r.vehicle_info || 'Unknown vehicle'} — ${r.status}`
        ).join('\n- '));
      }
      dataLines.push('Unpaid invoices: ' + unpaidInvoices.length + ' ($' + totalOwed.toFixed(2) + ' owed)');
      if (lowStock.length) {
        dataLines.push('Low stock parts (' + lowStock.length + '): ' + lowStock.slice(0, 5).map((p: any) =>
          `${p.name} (${p.quantity} left, min ${p.min_stock})`
        ).join(', '));
      }
      dataLines.push("Today's appointments: " + appointments.length);

      sys += '\n\nLive Shop Data:\n- ' + dataLines.join('\n- ');
      if (vehicle) sys += '\nVehicle: ' + vehicle;
      if (description) sys += '\nJob: ' + description;
      if (shop_context) sys += '\n\nAdditional context:\n' + JSON.stringify(shop_context);

      // Build conversation prompt
      const recent = messages.filter((m: any) => m.role !== 'system').slice(-6);
      let prompt = sys + '\n\nConversation:\n' +
        recent.map((m: any) => (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content).join('\n') +
        '\n\nRespond to the latest message as LBC Auto AI. Be concise. Reference live shop data when relevant. If this is a diagnostic or service question, end your reply with [OFFER_APT] on a new line.';

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

      // Parse out the [OFFER_APT] flag
      const offerApt = reply.includes('[OFFER_APT]');
      reply = reply.replace(/\[OFFER_APT\]/g, '').trim();

      return Response.json({ reply, offer_appointment: offerApt }, { headers: CORS_HEADERS });
    }

    // ════════════════════════════════════════════════════════════
    // CUSTOMER MODE — no auth, uses SHOP_CONFIGS + live shop lookup
    // ════════════════════════════════════════════════════════════
    const sr = base44.asServiceRole;
    const shopCfg = SHOP_CONFIGS[shop_email] || SHOP_CONFIGS['hajwheels@gmail.com'];

    // Try to enrich with live shop data from the User entity
    let liveContext = shopCfg.context;
    try {
      const shopUsers = await sr.entities.User.filter({ email: shop_email }, null, 1);
      const shop = shopUsers[0];
      if (shop) {
        if (shop.business_name) liveContext = liveContext.replace(shopCfg.name, shop.business_name);
        if (shop.phone) liveContext = liveContext.replace(shopCfg.phone, shop.phone);
        if (shop.address) liveContext += `\nShop address: ${shop.address}`;
      }
    } catch (e) { /* use config fallback */ }

    const recent = messages.filter((m: any) => m.role !== 'system').slice(-8);
    const prompt = liveContext +
      '\n\nConversation:\n' +
      recent.map((m: any) => (m.role === 'user' ? 'Customer: ' : 'Assistant: ') + m.content).join('\n') +
      '\n\nRespond to the latest message as the booking assistant. After answering the service question, offer to schedule an appointment. End your reply with [OFFER_APT] on a new line if you answered a service question.';

    const result = await sr.integrations.Core.InvokeLLM({ prompt });
    let reply =
      (typeof result === 'string' ? result : null) ||
      result?.reply ||
      result?.content ||
      result?.message ||
      'No response generated.';

    // Parse out the [OFFER_APT] flag
    const offerApt = reply.includes('[OFFER_APT]');
    reply = reply.replace(/\[OFFER_APT\]/g, '').trim();

    return Response.json({ reply, offer_appointment: offerApt }, { headers: CORS_HEADERS });

  } catch (err: any) {
    console.error('lbcAutoAI error:', err?.message);
    return Response.json(
      { reply: 'AI temporarily unavailable. Please call your shop directly.' },
      { status: 200, headers: CORS_HEADERS }
    );
  }
});
