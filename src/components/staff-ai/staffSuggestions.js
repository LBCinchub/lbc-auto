// Page-aware quick prompts: shop-record prompts for the current page, plus general advice.
const BY_PAGE = [
  [/^\/(Invoices|InvoiceDetail)/i, [{ label: "Unpaid Invoices", q: "Show unpaid invoices" }]],
  [/^\/(Estimates|EstimateDetail)/i, [{ label: "Draft Estimates", q: "Show draft estimates" }]],
  [/^\/(RepairOrders|RepairOrderDetail)/i, [{ label: "Open Repair Orders", q: "Show open repair orders" }]],
  [/^\/Appointments/i, [{ label: "Today's Appointments", q: "What appointments do we have today?" }]],
  [/^\/Parts/i, [{ label: "Low Stock", q: "Which parts are low on stock?" }]],
  [/^\/CustomerProfile/i, [{ label: "This Customer's Open Work", q: "Show this customer's open work and unpaid invoices" }]],
  [/^\/VehicleTimeline/i, [{ label: "Service History", q: "Show this vehicle's service history" }]],
];
const DEFAULT_SHOP = [
  { label: "Today's Appointments", q: "What appointments do we have today?" },
  { label: "This Month So Far", q: "How much have we collected this month and what is still owed?" },
];
const ADVICE = [
  { label: "Parts Needed", q: "What parts are needed for front brake pads and rotors?" },
  { label: "Brake Job Hours", q: "How many hours for a full brake job (pads + rotors, all 4 wheels)?" },
  { label: "P0420 Code", q: "What does P0420 mean and how many hours to fix?" },
  { label: "Rust Factor", q: "How do I adjust labor hours for a heavily rusted Canadian car?" },
];

export function staffSuggestions(pathname) {
  const hit = BY_PAGE.find(([re]) => re.test(pathname || ""));
  return [...(hit ? hit[1] : DEFAULT_SHOP), ...ADVICE];
}