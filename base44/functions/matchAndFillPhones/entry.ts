import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const file_url = body.file_url;

  // Fetch the uploaded file
  const response = await fetch(file_url);
  const text = await response.text();

  // Parse tab-separated: Customer | Email | Mobile
  const lines = text.split('\n').slice(1);
  const phoneMap = new Map();

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const name = (parts[0] || '').trim();
    const phone = (parts[2] || (parts[1] || '')).trim().replace(/\D/g, '');
    if (name && phone && phone.length >= 7) {
      phoneMap.set(name.toLowerCase(), phone);
    }
  }

  // Fetch ALL customers for the current user (paginated)
  let allCustomers = [];
  let skip = 0;
  const limit = 100;
  while (true) {
    const batch = await base44.entities.Customer.list('-created_date', limit, skip);
    if (!batch || batch.length === 0) break;
    allCustomers = allCustomers.concat(batch);
    if (batch.length < limit) break;
    skip += limit;
    await sleep(300);
  }

  let updated = 0;
  let matched = 0;
  const notFound = [];

  for (const customer of allCustomers) {
    const existingPhone = (customer.phone || '').replace(/\D/g, '');
    if (existingPhone.length >= 7) continue; // already has phone, skip

    const nameLower = (customer.full_name || '').toLowerCase().trim();
    let foundPhone = phoneMap.get(nameLower);

    // Partial match if no exact match
    if (!foundPhone) {
      for (const [fileNameLower, filePhone] of phoneMap) {
        const nameParts = nameLower.split(' ').filter(Boolean);
        const fileParts = fileNameLower.split(' ').filter(Boolean);
        if (
          nameParts.length >= 2 && fileParts.length >= 2 &&
          nameParts[0] === fileParts[0] &&
          nameParts[nameParts.length - 1] === fileParts[fileParts.length - 1]
        ) {
          foundPhone = filePhone;
          break;
        }
      }
    }

    if (foundPhone) {
      try {
        await base44.entities.Customer.update(customer.id, { phone: foundPhone });
        if (phoneMap.has(nameLower)) {
          updated++;
        } else {
          matched++;
        }
        await sleep(150); // rate limit buffer
      } catch (e) {
        if (e.status === 429) {
          await sleep(2000);
          try {
            await base44.entities.Customer.update(customer.id, { phone: foundPhone });
            updated++;
          } catch (_) {
            notFound.push(customer.full_name);
          }
        } else {
          notFound.push(customer.full_name);
        }
      }
    } else {
      notFound.push(customer.full_name);
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