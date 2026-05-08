import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// v2 - import customers, phones, and vehicles from CSV
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const csv_url = body.csv_url;

  const response = await fetch(csv_url);
  const text = await response.text();

  const lines = text.split('\n').slice(1); // skip header

  // Build unique customer map: name -> { phone, vehicles: Set<string> }
  const customerMap = new Map();

  for (const line of lines) {
    if (!line.trim()) continue;

    // Parse quoted CSV
    const fields = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());

    const customerName = (fields[4] || '').replace(/^"|"$/g, '').trim();
    const company = (fields[5] || '').replace(/^"|"$/g, '').trim();
    const vehicleInfo = (fields[6] || '').replace(/^"|"$/g, '').trim();

    // Skip blanks / placeholders
    if (!customerName || customerName.toLowerCase() === 'customer 1' || customerName.length < 2) continue;
    if (customerName.includes('undefined')) continue;

    // Company field sometimes holds a phone number
    const digitsOnly = company.replace(/\D/g, '');
    const phone = digitsOnly.length >= 7 ? digitsOnly : '';

    if (!customerMap.has(customerName)) {
      customerMap.set(customerName, { phone, vehicles: new Set() });
    } else {
      const existing = customerMap.get(customerName);
      if (phone && !existing.phone) existing.phone = phone;
    }

    if (vehicleInfo && vehicleInfo.length > 2) {
      customerMap.get(customerName).vehicles.add(vehicleInfo.trim());
    }
  }

  let customersCreated = 0;
  let vehiclesCreated = 0;
  const errors = [];

  for (const [name, data] of customerMap) {
    try {
      const customer = await base44.asServiceRole.entities.Customer.create({
        full_name: name,
        phone: data.phone || '',
      });
      customersCreated++;

      for (const vehicleStr of data.vehicles) {
        try {
          // Extract year
          const yearMatch = vehicleStr.match(/\b(19|20)\d{2}\b/);
          const year = yearMatch ? parseInt(yearMatch[0]) : 0;
          const makeModel = vehicleStr.replace(yearMatch ? yearMatch[0] : '', '').trim();
          const parts = makeModel.split(/\s+/).filter(Boolean);
          const make = parts[0] || 'Unknown';
          const model = parts.slice(1).join(' ') || '';

          await base44.asServiceRole.entities.Vehicle.create({
            customer_id: customer.id,
            customer_name: name,
            make,
            model: model || make,
            year,
            vehicle_info: vehicleStr,
          });
          vehiclesCreated++;
        } catch (e) {
          errors.push(`Vehicle [${name}]: ${e.message}`);
        }
      }
    } catch (e) {
      errors.push(`Customer [${name}]: ${e.message}`);
    }
  }

  return Response.json({
    success: true,
    customers_created: customersCreated,
    vehicles_created: vehiclesCreated,
    total_unique_customers: customerMap.size,
    errors: errors.slice(0, 30),
  });
});