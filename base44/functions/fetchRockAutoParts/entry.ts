import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { year, make, model, engine } = await req.json();

    if (!year || !make || !model) {
      return Response.json({ error: 'Year, make, and model are required' }, { status: 400 });
    }

    // Using the rockauto-api Python package approach but adapted for Deno
    // For now, we'll return a sample structure - in production you'd integrate with the API
    const rockAutoUrl = `https://www.rockauto.com`;
    
    // Fetch vehicle parts from RockAuto
    const response = await fetch(`${rockAutoUrl}/catalog/api/parts?year=${year}&make=${make}&model=${model}`);
    
    if (!response.ok) {
      return Response.json({ 
        error: 'Failed to fetch from RockAuto',
        message: response.statusText 
      }, { status: 500 });
    }

    const data = await response.json();
    
    // Transform RockAuto data to our Part schema
    const parts = (data.parts || []).map(p => ({
      name: p.description || p.name,
      part_number: p.part_id || p.part_number,
      supplier: 'RockAuto',
      cost_price: p.warehouse_price || 0,
      sale_price: p.customer_price || 0,
      quantity: 0, // Set default quantity to 0
      category: p.category || 'Imported'
    }));

    return Response.json({ 
      success: true,
      parts,
      count: parts.length,
      vehicle: `${year} ${make} ${model}`
    });

  } catch (error) {
    console.error('Error fetching RockAuto parts:', error);
    return Response.json({ 
      error: error.message,
      message: 'Failed to fetch parts from RockAuto. Please try again.'
    }, { status: 500 });
  }
});