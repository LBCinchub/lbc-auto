// Saves a plain-text receipt for a Stripe-verified card payment.
export function downloadReceipt({ shop_name, invoice_number, amount, currency, paid_at }) {
  const lines = [
    `${shop_name || "Your auto shop"} - Payment receipt`,
    "",
    `Invoice: ${invoice_number || "-"}`,
    `Amount paid: $${Number(amount || 0).toFixed(2)} ${currency || ""}`.trim(),
    `Paid on: ${new Date(paid_at || Date.now()).toLocaleString()}`,
    "Payment method: Card (Stripe)",
    "",
    "Thank you for your payment.",
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `receipt-${invoice_number || "payment"}.txt` });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}