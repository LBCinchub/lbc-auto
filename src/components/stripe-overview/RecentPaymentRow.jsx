import React from "react";
import { Link } from "react-router-dom";
import { money, whenLabel } from "@/lib/stripeOverview";

// A successful payment. Invoice payments open the invoice in LBC Auto; others open in Stripe.
export default function RecentPaymentRow({ payment, timeZone }) {
  const refunded = payment.refunded > 0;
  const status = refunded ? `Refunded ${money(payment.refunded, payment.currency, true)}` : "Paid";
  const meta = [status, payment.reference, whenLabel(payment.created, timeZone)].filter(Boolean).join(" · ");
  const body = (
    <>
      <span className="dh2-item-l">
        <span className={`dh2-glyph${refunded ? " dh2-glyph--warn" : ""}`} aria-hidden="true" />
        <span className="dh2-what">
          <span className="dh2-name">{payment.name}</span>
          <span className="dh2-meta">{meta}</span>
        </span>
      </span>
      <span className={`dh2-amt${refunded ? " dh2-amt--warn" : ""}`}>{money(payment.amount, payment.currency, true)}</span>
    </>
  );

  return (
    <li>
      {payment.invoice_id ? (
        <Link className="dh2-item" to={`/InvoiceDetail/${payment.invoice_id}`}>{body}</Link>
      ) : (
        <a className="dh2-item" href={payment.stripe_url} target="_blank" rel="noopener noreferrer">{body}</a>
      )}
    </li>
  );
}