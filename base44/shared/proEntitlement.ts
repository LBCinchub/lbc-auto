// Pro entitlement for document texting (estimate/invoice PDF MMS and "Send As Text").
// Authority: the shop's own LBC Auto subscription in the platform Stripe account, looked up by the
// authenticated user's ID. The user's plan_tier / subscription fields are NOT trusted here because
// shops can edit their own profile. Anything missing or unverifiable fails closed.

export const PLAN_PRICE_IDS = {
  basic: "price_1U5bgEBCRALtpjBvSFWy6LYh",
  pro: "price_1U5bgFBCRALtpjBvvO8pB7oO",
  setup_fee: "price_1U5bgFBCRALtpjBv6x2G1hLE",
};

export const PRO_REQUIRED = "pro_required";
export const PRO_UNVERIFIED = "pro_unverified";
export const PRO_CODES = [PRO_REQUIRED, PRO_UNVERIFIED];

const deny = (code, error) => ({ ok: false, status: 403, code, error });
const REQUIRED_MSG = "Texting estimates and invoices is a Pro plan feature. Upgrade to Pro to send. Nothing was sent.";
const UNVERIFIED_MSG = "Your Pro plan couldn't be confirmed right now, so texting is unavailable. Nothing was sent.";

// deps: { user (from verified auth), stripeKey, appId, fetchFn, now }
export async function checkProEntitlement({ user, stripeKey, appId = "", fetchFn = fetch, now = Date.now }) {
  const userId = String(user?.id || "");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(userId)) return deny(PRO_REQUIRED, REQUIRED_MSG);
  if (!stripeKey) return deny(PRO_UNVERIFIED, UNVERIFIED_MSG);
  const query = encodeURIComponent(`metadata['user_id']:'${userId}'`);
  const res = await fetchFn(`https://api.stripe.com/v1/subscriptions/search?query=${query}&limit=20`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res || !res.ok) return deny(PRO_UNVERIFIED, UNVERIFIED_MSG);
  const data = await res.json().catch(() => null);
  if (!data || !Array.isArray(data.data)) return deny(PRO_UNVERIFIED, UNVERIFIED_MSG);

  const nowSec = now() / 1000;
  const pro = data.data.find((sub) =>
    sub?.status === "active" &&
    String(sub.metadata?.user_id || "") === userId &&
    String(sub.metadata?.base44_app_id || "") === String(appId || "") &&
    (sub.items?.data || []).some((item) => {
      if (item?.price?.id !== PLAN_PRICE_IDS.pro) return false;
      const end = Number(item.current_period_end ?? sub.current_period_end ?? 0);
      return !end || end > nowSec;
    }),
  );
  if (!pro) return deny(PRO_REQUIRED, REQUIRED_MSG);
  return { ok: true, user_id: userId, subscription_id: String(pro.id || "") };
}

// Defense in depth for shared senders: a grant must exist and belong to the acting user.
export function proGrantDenial(entitlement, user) {
  if (entitlement?.ok === true && entitlement.user_id && entitlement.user_id === String(user?.id || "")) return null;
  return deny(PRO_REQUIRED, REQUIRED_MSG);
}