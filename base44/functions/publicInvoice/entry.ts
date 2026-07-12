import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SHOP_CONFIGS: Record<string, { name: string; phone: string; address: string }> = {
  'hajwheels@gmail.com':         { name: 'Haj Rims & Tires',   phone: '613-672-2727', address: 'Gatineau, QC' },
  'belalautoservices@gmail.com': { name: 'Belal Auto Services', phone: '613-000-0000', address: '' },
  'aka.auto.group@gmail.com':    { name: 'AKA Auto Group',      phone: '613-000-0000', address: '' },
  'terryfoxauto@gmail.com':      { name: 'Terry Fox Auto',      phone: '613-000-0000', address: '' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/html; charset=UTF-8' };

  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const invoiceId = url.searchParams.get('id');

    if (!invoiceId) return new Response('Missing invoice ID', { status: 400, headers: corsHeaders });

    const invoice = await base44.asServiceRole.entities.Invoice.get(invoiceId);
    if (!invoice) return new Response('Invoice not found', { status: 404, headers: corsHeaders });

    // Shop info from tenant config (NOT from User entity)
    const shop = SHOP_CONFIGS[invoice.shop_email] || SHOP_CONFIGS['hajwheels@gmail.com'];

    const fmt = (n: any) => `$${(parseFloat(n) || 0).toFixed(2)}`;

    // Compute subtotal from line_items (do NOT trust invoice.subtotal — field may not exist)
    const lineItems = invoice.line_items || [];
    const laborTotal = lineItems.filter((i: any) => i.type === 'labor').reduce((s: number, i: any) => s + (parseFloat(i.total) || 0), 0);
    const partsTotal = lineItems.filter((i: any) => i.type === 'part').reduce((s: number, i: any) => s + (parseFloat(i.total) || 0), 0);
    let subtotal = Math.round((laborTotal + partsTotal) * 100) / 100;
    // Fallback if line_items is empty (legacy invoices)
    if (subtotal === 0 && invoice.total) {
      subtotal = Math.round(((parseFloat(invoice.total) || 0) - (parseFloat(invoice.tax_amount) || 0)) * 100) / 100;
    }

    // Back-calculate tax rate for display
    const taxPct = subtotal > 0 ? Math.round((parseFloat(invoice.tax_amount) || 0) / subtotal * 10000) / 100 : 0;

    const statusColor = invoice.status === 'paid' ? '#16a34a' : invoice.status === 'partial' ? '#d97706' : '#dc2626';
    const statusLabel = invoice.status === 'paid' ? 'PAID' : invoice.status === 'partial' ? 'PARTIAL PAYMENT' : 'UNPAID';

    const invoiceDate = invoice.invoice_date || new Date(invoice.created_date).toLocaleDateString('en-CA');
    const today = new Date().toLocaleDateString('en-CA');

    const itemRows = lineItems.filter((i: any) => i.description).map((item: any) => `
      <tr>
        <td>${item.description}</td>
        <td class="center">${item.type === 'labor' ? 'Labour' : 'Part'}</td>
        <td class="center">${item.quantity || 1}</td>
        <td class="right">${fmt(item.unit_price)}</td>
        <td class="right">${fmt(item.total)}</td>
      </tr>`).join('');

    const paymentRows = (invoice.payment_history || []).map((p: any) => `
      <tr>
        <td>${p.date || '—'}</td>
        <td>${p.method || '—'}</td>
        <td class="right">${fmt(p.amount)}</td>
        <td>${p.note || '—'}</td>
      </tr>`).join('');

    const balanceDue = Math.round((parseFloat(invoice.balance_due) || 0) * 100) / 100;
    const waMsg = `Hi ${invoice.customer_name || 'Customer'}, your invoice ${invoice.invoice_number || 'N/A'} from ${shop.name} is ready. Total: ${fmt(invoice.total)}. Balance due: ${fmt(balanceDue)}. Call us: ${shop.phone}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(waMsg)}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoice_number || 'N/A'} — ${shop.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; color: #1a1a2e; font-size: 14px; }
    .page { max-width: 820px; margin: 30px auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.10); overflow: hidden; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%); color: white; padding: 36px 40px 28px; display: flex; justify-content: space-between; align-items: flex-start; }
    .shop-name { font-size: 22px; font-weight: 700; }
    .shop-tagline { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    .shop-contact { font-size: 12px; color: #cbd5e1; margin-top: 8px; line-height: 1.8; }
    .invoice-meta { text-align: right; }
    .invoice-number { font-size: 20px; font-weight: 700; letter-spacing: 1px; }
    .invoice-date { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    .status-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-top: 10px; background: ${statusColor}; color: white; }
    .bill-section { display: flex; justify-content: space-between; padding: 28px 40px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
    .bill-to h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; }
    .bill-to .name { font-size: 16px; font-weight: 600; }
    .bill-to .sub { font-size: 13px; color: #475569; margin-top: 4px; }
    .table-section { padding: 28px 40px; }
    .table-section h3 { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 14px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; }
    thead th { background: #1a1a2e; color: white; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; }
    thead th.center { text-align: center; } thead th.right { text-align: right; }
    tbody tr { border-bottom: 1px solid #e2e8f0; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody td { padding: 10px 12px; font-size: 13px; }
    td.center { text-align: center; } td.right { text-align: right; }
    .totals-section { padding: 0 40px 28px; display: flex; justify-content: flex-end; }
    .totals-box { width: 300px; background: #f8fafc; border-radius: 8px; padding: 18px 20px; border: 1px solid #e2e8f0; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #475569; }
    .totals-row.sep { border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 10px; }
    .totals-row.bold { font-size: 15px; font-weight: 700; color: #1a1a2e; }
    .totals-row.balance { font-size: 15px; font-weight: 700; color: ${statusColor}; }
    .payment-section { padding: 0 40px 28px; }
    .payment-section h3 { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 12px; text-transform: uppercase; }
    .payment-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .payment-table th { background: #e2e8f0; padding: 8px 12px; text-align: left; font-size: 12px; }
    .payment-table td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
    .footer { background: #1a1a2e; color: #94a3b8; text-align: center; padding: 18px 40px; font-size: 12px; }
    .action-bar { text-align: center; padding: 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .btn { display: inline-block; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; border: none; margin: 0 6px; text-decoration: none; cursor: pointer; }
    .btn-primary { background: #1a1a2e; color: white; }
    .btn-wa { background: #25D366; color: white; }
    @media print { body { background: white; } .page { box-shadow: none; margin: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="action-bar no-print">
    <button class="btn btn-primary" onclick="window.print()">🖨️ Print / Save PDF</button>
    <a class="btn btn-wa" href="${waUrl}" target="_blank">💬 Share via WhatsApp</a>
  </div>
  <div class="page">
    <div class="header">
      <div>
        <div class="shop-name">🔧 ${shop.name}</div>
        <div class="shop-tagline">Powered by LBC Auto</div>
        <div class="shop-contact">
          ${shop.phone ? `📞 ${shop.phone}<br>` : ''}
          ${shop.address ? `📍 ${shop.address}` : ''}
        </div>
      </div>
      <div class="invoice-meta">
        <div class="invoice-number">${invoice.invoice_number || 'NO NUMBER'}</div>
        <div class="invoice-date">Date: ${invoiceDate}</div>
        <div class="invoice-date">Printed: ${today}</div>
        <div class="status-badge">${statusLabel}</div>
      </div>
    </div>
    <div class="bill-section">
      <div class="bill-to">
        <h3>Bill To</h3>
        <div class="name">${invoice.customer_name || '—'}</div>
        <div class="sub">🚗 ${invoice.vehicle_info || '—'}</div>
        ${invoice.customer_phone ? `<div class="sub">📞 ${invoice.customer_phone}</div>` : ''}
      </div>
      <div class="bill-to" style="text-align:right">
        <h3>Invoice Details</h3>
        <div class="sub">Invoice #: <strong>${invoice.invoice_number || 'N/A'}</strong></div>
        <div class="sub">Status: <strong style="color:${statusColor}">${statusLabel}</strong></div>
        <div class="sub">Balance Due: <strong style="color:${statusColor}">${fmt(balanceDue)}</strong></div>
      </div>
    </div>
    <div class="table-section">
      <h3>Services &amp; Parts</h3>
      <table>
        <thead><tr><th>Description</th><th class="center">Type</th><th class="center">Qty</th><th class="right">Unit Price</th><th class="right">Total</th></tr></thead>
        <tbody>${itemRows || '<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8">No line items recorded</td></tr>'}</tbody>
      </table>
    </div>
    <div class="totals-section">
      <div class="totals-box">
        <div class="totals-row"><span>Labour</span><span>${fmt(laborTotal)}</span></div>
        <div class="totals-row"><span>Parts</span><span>${fmt(partsTotal)}</span></div>
        <div class="totals-row sep"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
        ${invoice.discount ? `<div class="totals-row"><span>Discount</span><span>-${fmt(invoice.discount)}</span></div>` : ''}
        <div class="totals-row"><span>Tax${taxPct ? ` (${taxPct}%)` : ''}</span><span>${fmt(invoice.tax_amount)}</span></div>
        <div class="totals-row bold sep"><span>Total</span><span>${fmt(invoice.total)}</span></div>
        ${invoice.amount_paid ? `<div class="totals-row" style="color:#16a34a"><span>Amount Paid</span><span>-${fmt(invoice.amount_paid)}</span></div>` : ''}
        <div class="totals-row balance"><span>Balance Due</span><span>${fmt(balanceDue)}</span></div>
      </div>
    </div>
    ${paymentRows ? `<div class="payment-section"><h3>Payment History</h3><table class="payment-table"><thead><tr><th>Date</th><th>Method</th><th>Amount</th><th>Note</th></tr></thead><tbody>${paymentRows}</tbody></table></div>` : ''}
    ${invoice.notes ? `<div style="padding:0 40px 28px"><div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;font-size:13px;color:#78350f"><strong>Notes:</strong> ${invoice.notes}</div></div>` : ''}
    <div class="footer">
      <p><strong>${shop.name}</strong> | ${shop.phone} | Powered by LBC Auto — lbchub.tech</p>
    </div>
  </div>
</body>
</html>`;

    return new Response(html, { headers: corsHeaders });
  } catch (err: any) {
    console.error('publicInvoice error:', err?.message);
    return new Response(`<h2>Error loading invoice: ${err?.message}</h2>`, { status: 500, headers: corsHeaders });
  }
});