// Individual payments made on one day, from each invoice's payment_history (or its single
// recorded payment), tagged cash / card / etransfer. Uses the amounts actually paid.
export function dayPayments(invoices, selectedDay) {
  const payments = [];
  invoices.forEach(inv => {
    if (inv.status !== "paid" && inv.status !== "partial") return;
    const history = inv.payment_history || [];
    if (history.length > 0) {
      history.forEach(p => {
        const day = (p.date || "").split("T")[0];
        if (day !== selectedDay) return;
        const amount = parseFloat(p.amount) || 0;
        if (amount <= 0) return;
        const m = (p.method || "").toLowerCase();
        const methodKey = m === "e-transfer" || m === "etransfer" || m === "e_transfer" ? "etransfer" : m === "card" ? "card" : "cash";
        payments.push({ invoice: inv, amount, method: methodKey });
      });
    } else if (inv.amount_paid > 0 && inv.paid_date) {
      const day = inv.paid_date.split("T")[0];
      if (day !== selectedDay) return;
      const amount = parseFloat(inv.amount_paid) || 0;
      if (amount <= 0) return;
      const m = inv.payment_method?.toLowerCase() || "";
      const methodKey = m === "e-transfer" || m === "etransfer" || m === "e_transfer" ? "etransfer" : (m === "card" || inv.card_last4) ? "card" : "cash";
      payments.push({ invoice: inv, amount, method: methodKey });
    }
  });
  return payments;
}

// Filter by the selected method (or keep all, grouped by method).
export function groupPayments(payments, method) {
  const filtered = method === "all" ? payments : payments.filter(p => p.method === method);
  const groups = method === "all"
    ? [
        { key: "cash",      label: "Cash 💵",       payments: filtered.filter(p => p.method === "cash") },
        { key: "card",      label: "Card 💳",       payments: filtered.filter(p => p.method === "card") },
        { key: "etransfer", label: "E-Transfer 📧", payments: filtered.filter(p => p.method === "etransfer") },
      ].filter(g => g.payments.length > 0)
    : [{ key: method, label: method === "etransfer" ? "E-Transfer 📧" : method === "card" ? "Card 💳" : "Cash 💵", payments: filtered }];
  return { filtered, groups };
}