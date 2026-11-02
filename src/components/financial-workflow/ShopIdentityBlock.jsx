import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { shopContact } from "@/lib/printContacts";
import { formatPhone } from "@/utils/formatPhone";

// The shop's own letterhead details (the same fields the printed document uses),
// shown in the estimate/invoice editor headers. Fetched fresh so edits made in
// Settings show up without a reload; the signed-in user renders instantly meanwhile.
export default function ShopIdentityBlock() {
  const { user } = useAuth();
  const { data: me } = useQuery({
    queryKey: ["shop-identity"],
    queryFn: () => base44.auth.me(),
    placeholderData: user || undefined,
  });
  const shop = shopContact(me);
  if (!shop) return null;

  return (
    <div className="max-w-[11rem] text-right text-xs leading-snug text-gray-400 sm:max-w-[16rem]" aria-label="Shop details">
      {shop.business_name ? (
        <p className="break-words text-sm font-bold text-white">{shop.business_name}</p>
      ) : (
        <Link to="/Settings" className="text-sm font-semibold text-sky-400 hover:underline">Add shop details</Link>
      )}
      <div className="hidden sm:block">
        {shop.address && <p className="whitespace-pre-line break-words">{shop.address}</p>}
        {shop.phone && <p>{formatPhone(shop.phone)}</p>}
        {shop.email && <p className="break-all">{shop.email}</p>}
        {shop.gst_number && <p>GST/Business #: {shop.gst_number}</p>}
      </div>
    </div>
  );
}