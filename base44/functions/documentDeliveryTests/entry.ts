import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { jsPDF } from 'npm:jspdf@4.2.0';
import { buildDocumentModel } from '../../shared/documentPdfModel.ts';
import { renderDocumentPdf } from '../../shared/documentPdfRender.ts';
import { pdfFileName, messageBody, containsUrl } from '../../shared/documentDelivery.ts';

// Admin-only runtime check of the PDF renderer with SYNTHETIC fixtures. Never reads shop records and
// never sends a message. action "inspect" stores the fixture PDF privately and returns a 5-minute link.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const shop = { business_name: 'Fixture Auto', phone: '6135550100', address: '1 Test St', gst_number: 'GST-0' };
    const inv = {
      invoice_number: 'INV-TEST1', customer_name: 'Test Customer', invoice_date: '2026-11-10', service_reason: 'Grinding noise when braking',
      line_items: [
        { type: 'part', name: 'Front Pads', description: 'Ceramic', quantity: 1, unit_price: 80, total: 80 },
        { type: 'labor', name: 'Brake Service', description: 'Front axle', quantity: 1.5, unit_price: 120, total: 180 },
        { type: 'part', name: 'Rear Rotors', description: 'Worn, replace soon', quantity: 0, unit_price: 150, total: 0 },
      ],
      parts_total: 80, labor_total: 180, discount: 10, discount_type: '$', tax_rate: 13, tax_applies_to: 'both', tax_amount: 32.5, total: 282.5,
      amount_paid: 100, balance_due: 182.5, payment_history: [{ date: '2026-11-10', amount: 100, method: 'Debit' }], customer_note: 'Recheck pads in 6 months',
    };
    const customer = { full_name: 'Test Customer', phone: '6135550199', email: 'test@example.test', address: '5 Fixture Ave' };
    const vehicle = { year: 2019, make: 'Honda', model: 'Civic', vin: '2HGFC2F59KH000000', license_plate: 'TEST123', mileage: 84000 };
    const bytes = renderDocumentPdf(jsPDF, buildDocumentModel('invoice', inv, customer, vehicle, shop));
    const raw = new TextDecoder('latin1').decode(bytes);
    const result = {
      runtime: 'deno', bytes: bytes.byteLength, header: raw.slice(0, 8), has_eof: raw.trimEnd().endsWith('%%EOF'),
      shows_total: raw.includes('($282.50) Tj'), shows_balance: raw.includes('($182.50) Tj'), file_name: pdfFileName('invoice', inv.invoice_number),
      body: messageBody(shop.business_name, 'invoice', inv.invoice_number), body_has_url: containsUrl(messageBody(shop.business_name, 'invoice', inv.invoice_number)),
    };
    if (body.action === 'inspect') {
      const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file: new File([bytes], result.file_name, { type: 'application/pdf' }) });
      const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 300 });
      result.signed_url = signed_url;
    }
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}