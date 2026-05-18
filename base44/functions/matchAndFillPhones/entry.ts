import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const file_url = body.file_url;

  // Fetch the file
  const response = await fetch(file_url);
  const text = await response.text();

  // Parse the tab-separated file: Customer | Email | Mobile
  const lines = text.split('\n').slice(1); // skip header
  const phoneMap = new Map(); // name (lowercase) -> phone

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const name = (parts[0] || '').trim();
    const phone = (parts[2] || '').trim().replace(/\D/g, '');
    if (name && phone && phone.length >= 7) {
      phoneMap.set(name.toLowerCase(), phone);
    }
  }

  // Fetch all customers for the current user (paginated)
  let allCustomers = [];
  let skip = 0;
  const limit = 200;
  while (true) {
    const batch = await base44.entities.Customer.list('-created_date', limit, skip);
    if (!batch || batch.length === 0) break;
    allCustomers = allCustomers.concat(batch);
    if (batch.length < limit) break;
    skip += limit;
  }

  // Find customers missing phone and match by name
  let updated = 0;
  let matched = 0;
  const notFound = [];

  for (const customer of allCustomers) {
    const phone = customer.phone;
    if (phone && phone.replace(/\D/g, '').length >= 7) continue; // already has phone

    const nameLower = (customer.full_name || '').toLowerCase().trim();
    const foundPhone = phoneMap.get(nameLower);

    if (foundPhone) {
      await base44.entities.Customer.update(customer.id, { phone: foundPhone });
      updated++;
    } else {
      // Try partial match (first + last name)
      let partialMatch = null;
      for (const [fileNameLower, filePhone] of phoneMap) {
        if (nameLower && fileNameLower && (
          fileNameLower.includes(nameLower) || nameLower.includes(fileNameLower) ||
          (nameLower.split(' ')[0] === fileNameLower.split(' ')[0] && nameLower.split(' ').pop() === fileNameLower.split(' ').pop())
        )) {
          partialMatch = filePhone;
          break;
        }
      }
      if (partialMatch) {
        await base44.entities.Customer.update(customer.id, { phone: partialMatch });
        matched++;
      } else {
        notFound.push(customer.full_name);
      }
    }
  }

  return Response.json({
    success: true,
    exact_matches_updated: updated,
    partial_matches_updated: matched,
    total_updated: updated + matched,
    still_missing: notFound.length,
    still_missing_names: notFound.slice(0, 20),
  });
});