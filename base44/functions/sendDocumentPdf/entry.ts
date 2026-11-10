import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { jsPDF } from 'npm:jspdf@4.2.0';
import { sendDocument, deliveryStatus, resolveDocument, latestDelivery, deliveryView, messageBody } from '../../shared/documentDelivery.ts';
import { buildDocumentModel } from '../../shared/documentPdfModel.ts';
import { renderDocumentPdf } from '../../shared/documentPdfRender.ts';
import { checkMmsSender, sendTwilioMms, fetchTwilioMessage } from '../../shared/twilioSms.ts';
import { maskPhone } from '../../shared/phone.ts';
import { checkProEntitlement } from '../../shared/proEntitlement.ts';
import { secrets } from 'base44:runtime';

const json = (data, status = 200) => Response.json(data, { status });
const appOrigin = (req) => {
  try { return new URL(req.headers.get('x-base44-app-url') || '').origin; } catch { return 'https://lbc-auto-flow.base44.app'; }
};

// The shop logo is embedded only from the platform's own media host (never an arbitrary URL).
async function loadLogo(url) {
  let u;
  try { u = new URL(String(url || '')); } catch { return null; }
  if (u.protocol !== 'https:' || u.hostname !== 'media.base44.com') return null;
  const r = await fetch(u, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!r || !r.ok) return null;
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.byteLength > 1_000_000) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return { bytes, format: 'PNG' };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { bytes, format: 'JPEG' };
  return null;
}

// Shop staff texts one saved estimate/invoice PDF to that document's own customer.
// Actions: prepare (read-only preview), send (explicit), status (read-only refresh).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (user.role !== 'admin' && !user.business_name) return json({ error: 'Shop owner access required' }, 403);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const db = base44.asServiceRole.entities;
    const tenant = String(user.email || '').toLowerCase();
    const type = String(body.document_type || '');

    // Pro only: checked fresh against billing before any preview, PDF build, upload or Twilio call.
    // Status reads stay open so already-authorized sends keep showing their real outcome.
    let entitlement = null;
    if (action === 'prepare' || action === 'send') {
      entitlement = await checkProEntitlement({ user, stripeKey: secrets.get('STRIPE_SECRET_KEY') || '', appId: secrets.get('BASE44_APP_ID') || '' });
      if (!entitlement.ok) return json({ error: entitlement.error, code: entitlement.code }, entitlement.status);
    }

    if (action === 'prepare') {
      const found = await resolveDocument(db, type, String(body.document_id || ''), tenant, user.id);
      if (found.error) return json({ error: found.error }, found.status);
      const sender = await checkMmsSender();
      const latest = await latestDelivery(db, tenant, found.doc.id);
      return json({
        document_number: found.number, customer_name: found.doc.customer_name || found.customer.full_name || '',
        to: maskPhone(found.phone), message: messageBody(user.business_name, type, found.number),
        sender_ready: sender.ok, sender_problem: sender.ok ? '' : sender.reason, latest: deliveryView(latest),
      });
    }

    const twilio = { senderCheck: checkMmsSender, send: sendTwilioMms, fetchMessage: fetchTwilioMessage };
    if (action === 'status') {
      const r = await deliveryStatus({ db, tenant, twilio }, body.delivery_id);
      return json(r.error ? { error: r.error } : { delivery: r.delivery, note: r.note || '' }, r.status);
    }
    if (action !== 'send') return json({ error: 'Unsupported action' }, 400);

    const origin = appOrigin(req);
    const logo = await loadLogo(user.business_logo || user.logo_url);
    const r = await sendDocument({
      db, tenant, user, twilio, entitlement,
      buildModel: buildDocumentModel,
      render: (model) => renderDocumentPdf(jsPDF, model, { logo }),
      storeFile: async (bytes, name) => {
        const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file: new File([bytes], name, { type: 'application/pdf' }) });
        return file_uri;
      },
      mediaBase: `${origin}/functions/documentMedia`,
      callbackUrl: `${origin}/functions/twilioMessageStatus`,
    }, body);
    return json(r.error ? { error: r.error, code: r.code || '', delivery: r.delivery || null } : { delivery: r.delivery, repeated: !!r.repeated }, r.status);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}