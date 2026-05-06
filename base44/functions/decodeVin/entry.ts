import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { vin } = await req.json();
    if (!vin || vin.length < 11) {
      return Response.json({ error: 'VIN must be at least 11 characters.' }, { status: 400 });
    }

    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`;
    const response = await fetch(url);
    const data = await response.json();

    const result = data?.Results?.[0];
    if (!result) {
      return Response.json({ error: 'No data returned from NHTSA.' }, { status: 404 });
    }

    // Extract relevant fields
    const make = result.Make || "";
    const model = result.Model || "";
    const year = parseInt(result.ModelYear) || null;
    const engineType = [result.DisplacementL ? `${parseFloat(result.DisplacementL).toFixed(1)}L` : "", result.FuelTypePrimary || "", result.EngineCylinders ? `${result.EngineCylinders}-cyl` : ""].filter(Boolean).join(" ") || "";
    const trim = result.Trim || "";
    const driveType = result.DriveType || "";
    const bodyClass = result.BodyClass || "";

    if (!make || !model) {
      return Response.json({ error: 'Could not decode VIN. Please enter vehicle details manually.' }, { status: 422 });
    }

    return Response.json({
      make,
      model,
      year,
      engine_type: engineType,
      trim,
      drive_type: driveType,
      body_class: bodyClass,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});