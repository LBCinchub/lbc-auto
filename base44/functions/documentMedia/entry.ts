import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { mediaDelivery, sha256Hex } from '../../shared/documentDelivery.ts';

// Twilio downloads the PDF attachment of one text from here. Access needs the exact delivery id plus
// its unguessable, expiring token (only a hash is stored); anything else gets the same bare 404.
// Nothing about the request (URL, token, query) is logged.
const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });

export default async function(req) {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const d = await mediaDelivery(base44.asServiceRole.entities, url.searchParams.get('d'), url.searchParams.get('t') || '');
    if (!d) return notFound();
    const headers = {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${d.file_name}"`,
      'Content-Length': String(d.file_bytes),
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
    };
    if (req.method === 'HEAD') return new Response(null, { status: 200, headers });
    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: d.file_uri, expires_in: 60 });
    const file = await fetch(signed_url, { signal: AbortSignal.timeout(20000) });
    if (!file.ok) return new Response('Unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== d.file_bytes || (await sha256Hex(bytes)) !== d.content_sha256) return new Response('Unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    return new Response(bytes, { status: 200, headers });
  } catch (_error) {
    return new Response('Unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}