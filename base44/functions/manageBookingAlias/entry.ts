import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { sha256Hex, randomToken, canonicalizePhone, localAliasFor, isValidTimeZone } from "../../shared/bookingPrimitives.ts";

// OWNER/ADMIN-ONLY secure provisioning for shop booking aliases.
// Actions: list_aliases | bind_alias | deactivate_alias | issue_credential.
// Credential values are shown ONCE to the admin (in the Settings UI) and are
// stored only as SHA-256 hashes — never logged, never in URLs.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const entities = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const action = body.action || "list_aliases";

    if (action === "list_aliases") {
      const aliases = await entities.ShopBookingAlias.filter({}, "-created_date", 100);
      return Response.json({
        success: true,
        aliases: aliases.map((a) => ({
          id: a.id,
          display_name: a.display_name,
          public_phone_e164: a.public_phone_e164,
          local_alias: a.local_alias,
          timezone: a.timezone,
          is_active: a.is_active,
          has_credential: !!a.credential_hash,
          verified_at: a.verified_at,
        })),
      });
    }

    if (action === "bind_alias") {
      // 1. Resolve the shop by stable internal ID or email — never guess.
      let shopUser = null;
      if (body.shop_user_id) {
        shopUser = (await entities.User.filter({ id: body.shop_user_id }, "-created_date", 1))[0] || null;
      } else if (body.shop_email) {
        shopUser = (await entities.User.filter({ email: norm(body.shop_email).toLowerCase() }, "-created_date", 1))[0] || null;
      }
      if (!shopUser) return Response.json({ blocked: "SHOP_NOT_FOUND" }, { status: 400 });

      // 2. Verify the phone against the shop's authoritative settings.
      const phoneDigits = String(body.phone || "").replace(/\D/g, "");
      const shopDigits = String(shopUser.phone || "").replace(/\D/g, "");
      if (!phoneDigits) return Response.json({ blocked: "PHONE_REQUIRED" }, { status: 400 });
      const e164 = canonicalizePhone(body.phone, body.country || "CA");
      if (!e164) return Response.json({ blocked: "PHONE_INVALID" }, { status: 400 });
      if (shopDigits !== phoneDigits) {
        return Response.json({ blocked: "PHONE_MISMATCH" }, { status: 409 });
      }

      // 3. Timezone + display name.
      const timezone = norm(body.timezone);
      if (!isValidTimeZone(timezone)) return Response.json({ blocked: "TIMEZONE_INVALID" }, { status: 400 });
      const displayName = norm(body.display_name) || shopUser.business_name || shopUser.full_name || "";
      const country = norm(body.country) || "CA";
      const local = localAliasFor(e164, country);

      // 4. Phone-reassignment safety: another ACTIVE alias holding this phone blocks.
      const allAliases = await entities.ShopBookingAlias.filter({}, "-created_date", 200);
      const heldBy = allAliases.find(
        (a) => a.is_active !== false && a.id !== body.alias_id &&
          (a.public_phone_e164 === e164 || (local && a.local_alias === local))
      );
      if (heldBy) return Response.json({ blocked: "PHONE_DUPLICATE" }, { status: 409 });

      // 5. Same-shop rebind (phone change) updates the existing alias.
      const own = allAliases.find((a) => a.shop_user_id === shopUser.id);
      const payload = {
        shop_user_id: shopUser.id,
        shop_owner_email: norm(shopUser.email).toLowerCase(),
        display_name: displayName,
        public_phone_e164: e164,
        local_alias: local || "",
        country,
        timezone,
        is_active: true,
        verified_at: new Date().toISOString(),
        verified_by: norm(user.email),
        verification_source: "shop_settings_phone",
      };
      const bookingKeys = await entities.WebBookingKey.filter(
        { shop_owner_email: norm(shopUser.email).toLowerCase() }, "-created_date", 1
      );
      if (bookingKeys[0]) payload.booking_key_id = bookingKeys[0].id;

      let alias;
      if (own) {
        alias = await entities.ShopBookingAlias.update(own.id, payload);
      } else {
        alias = await entities.ShopBookingAlias.create(payload);
      }
      return Response.json({
        success: true,
        alias: {
          id: alias.id, display_name: alias.display_name,
          public_phone_e164: alias.public_phone_e164, local_alias: alias.local_alias,
          timezone: alias.timezone, is_active: alias.is_active,
        },
      });
    }

    if (action === "deactivate_alias") {
      const alias = (await entities.ShopBookingAlias.filter({ id: body.alias_id }, "-created_date", 1))[0];
      if (!alias) return Response.json({ blocked: "ALIAS_NOT_FOUND" }, { status: 404 });
      await entities.ShopBookingAlias.update(alias.id, { is_active: false });
      return Response.json({ success: true });
    }

    if (action === "issue_credential") {
      const alias = (await entities.ShopBookingAlias.filter({ id: body.alias_id }, "-created_date", 1))[0];
      if (!alias) return Response.json({ blocked: "ALIAS_NOT_FOUND" }, { status: 404 });
      if (!alias.verified_at) return Response.json({ blocked: "ALIAS_NOT_VERIFIED" }, { status: 409 });
      const credential = randomToken("lbcwb_");
      await entities.ShopBookingAlias.update(alias.id, {
        credential_hash: await sha256Hex(credential),
        credential_issued_at: new Date().toISOString(),
        credential_issued_by: norm(user.email),
      });
      // Shown once to the admin UI; never stored or logged in plaintext.
      return Response.json({ success: true, credential });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("manageBookingAlias failure", { message: error?.message });
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

const norm = (s) => String(s ?? "").trim();