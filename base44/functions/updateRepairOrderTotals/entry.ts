import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await req.json();

    if (!orderId) {
      return Response.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const order = await base44.entities.RepairOrder.get(orderId);

    if (!order) {
      return Response.json({ error: 'Repair order not found' }, { status: 404 });
    }

    // Calculate labor cost
    const laborCost = (order.labor_items || []).reduce((sum, item) => {
      return sum + ((item.hours || 0) * (item.rate || 0));
    }, 0);

    // Calculate parts cost
    const partsCost = (order.parts_used || []).reduce((sum, part) => {
      return sum + (part.total || 0);
    }, 0);

    // Calculate labor hours
    const laborHours = (order.labor_items || []).reduce((sum, item) => {
      return sum + (item.hours || 0);
    }, 0);

    // Update the repair order with new totals
    await base44.entities.RepairOrder.update(orderId, {
      labor_cost: laborCost,
      labor_hours: laborHours,
      parts_cost: partsCost,
      total_cost: laborCost + partsCost,
    });

    return Response.json({ 
      success: true,
      labor_cost: laborCost,
      labor_hours: laborHours,
      parts_cost: partsCost,
      total_cost: laborCost + partsCost,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});