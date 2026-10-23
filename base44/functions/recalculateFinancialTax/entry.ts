import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { inspectFinancialTax, InspectionError } from '../../shared/financialTaxInspection.ts';

// SAFETY: read-only inspection of ONE caller-owned Invoice/Estimate. The legacy bulk apply (which listed
// all shops and wrote by default with incorrect tax math) is blocked; any apply/override request gets 409.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const result = await inspectFinancialTax({ user, body: body && typeof body === 'object' ? body : {}, svc: base44.asServiceRole.entities });
    return Response.json(result);
  } catch (error) {
    if (error instanceof InspectionError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    return Response.json({ error: 'Tax inspection failed' }, { status: 500 });
  }
}