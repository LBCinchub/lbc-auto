import React, { useState } from "react";
import { CheckCircle2, Tag, ThumbsUp } from "lucide-react";
import { formatDate } from "@/components/customer-dashboard/portalUtils";

export default function OffersView({ offers, onReact }) {
  const [busy, setBusy] = useState(""); const [notice, setNotice] = useState("");
  const react = async (offer) => { setBusy(offer.id); setNotice(""); try { await onReact(offer); setNotice("Reaction saved."); } finally { setBusy(""); } };
  return <section><div className="portal-section-heading"><div><p className="portal-eyebrow">From your shop</p><h2>Active offers</h2></div><Tag /></div>{notice && <p className="portal-inline-success"><CheckCircle2 />{notice}</p>}<div className="portal-offer-grid">{offers.length ? offers.map((offer) => <article key={offer.id}>{offer.image_url && <img src={offer.image_url} alt="" />}<div><p className="portal-eyebrow">{offer.valid_until ? `Available until ${formatDate(offer.valid_until)}` : "Current offer"}</p><h3>{offer.title}</h3><p>{offer.description}</p><button className="portal-secondary-button" disabled={busy === offer.id} onClick={() => react(offer)}><ThumbsUp />{offer.reactions?.thumbsup || 0} Like</button></div></article>) : <div className="portal-empty portal-panel"><Tag /><h3>No active offers right now</h3><p>New shop offers appear here when available.</p></div>}</div></section>;
}