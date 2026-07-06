// teamLogin v1 — verifies a mechanic/office-staff PIN for a given shop.
// Used by the public /lbc-team page so team members without a Base44 account
// can log in with just their 4-digit PIN.
//
// Why this exists: the Mechanic entity's RLS restricts reads to
// created_by === {{user.email}}, so a team member (not logged in as the shop
// owner, usually not logged in at all) could never read the mechanic list
// directly from the browser — every PIN would silently look "wrong" because
// the fetched list was always empty. asServiceRole bypasses RLS here, and we
// only ever return the single matched mechanic's info — never the full list
// or anyone's PIN — back to the browser.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const { shop_email, pin } = await req.json();
    const email = (shop_email || "").toLowerCase().trim();

    if (!email) {
      return new Response(JSON.stringify({ success: false, error: "Invalid shop link" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // asServiceRole bypasses RLS — reads all mechanics for this shop regardless of who's asking
    const mechanics = await base44.asServiceRole.entities.Mechanic.filter(
      { created_by: email },
      "name",
      200
    );
    const withPins = mechanics.filter((m) => m.pin && String(m.pin).trim().length === 4);

    if (!pin) {
      // Initial page load — just report whether this shop has any PIN-enabled team members,
      // so the page can show the "no techs with a PIN set" warning without needing PINs.
      return new Response(JSON.stringify({ success: true, has_team: withPins.length > 0 }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const match = withPins.find((m) => String(m.pin).trim() === String(pin).trim());
    if (!match) {
      return new Response(JSON.stringify({ success: false, error: "Wrong PIN" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      mechanic: {
        id: match.id,
        name: match.name,
        specialty: match.specialty || "",
        hourly_rate: match.hourly_rate || 0,
        role: match.role || "mechanic",
      }
    }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
});
