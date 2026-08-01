export const tourSteps = [
  { title: "Center Control Dashboard", eyebrow: "Owner command center", description: "See today’s estimate-first workload, financial performance, technician productivity, and every connected handoff. Insights, Overview, Profit & Loss, payment-method and end-of-day summaries support printable and PDF-ready reviews.", bullets: ["Estimate-first operating overview", "Performance, productivity, average-job, and reporting context", "Office Assistant support with shop-isolated records"], metrics: [["Appointments", "12"], ["Estimates", "6"], ["Day total • Demo", "$4.8k"]], flow: ["Appointment", "Estimate", "Approval"], records: ["8:30 • Vehicle intake", "10:00 • Estimate sent", "2:30 • End-of-day report"] },
  { title: "Customers & Vehicles", eyebrow: "A complete service story", description: "Complete contact profiles connect multiple vehicles, mileage, photos, recommendations, and service timelines to every future visit, with controlled import and data-quality support.", bullets: ["Multi-vehicle customer profiles", "Mileage, photos, recommendations, and service history", "Controlled customer import and contact cleanup"], metrics: [["Vehicles", "2"], ["Visits", "11"], ["Open items", "3"]], flow: ["Profile", "Vehicles", "Timeline"], records: ["2019 Sample Sedan • 84,210 km", "Brake service • Completed", "Tire rotation • Recommended"] },
  { title: "Appointments & Intake", eyebrow: "From booking to a clear estimate", description: "Bring branded online booking, phone, walk-in, and scheduled arrivals into a consistent intake process, connect the customer and vehicle, then prepare the estimate.", bullets: ["Branded shop website and booking entry", "Customer, vehicle, concern, and mileage intake", "Appointment → Intake → Estimate"], metrics: [["Arriving", "6"], ["Checked in", "3"], ["Estimates", "2"]], flow: ["Appointment", "Intake", "Estimate"], records: ["9:00 • Sample Customer", "Concern: steering vibration", "Estimate draft • Demo"] },
  { title: "Estimates → Approval → Repair Orders", eyebrow: "Approved scope becomes trackable work", description: "Build and send the estimate first, record customer approval or decline, then convert approved work into a Repair Order with technician status through completion and invoicing.", bullets: ["Estimate → Send → Approval/Decline → Repair Order", "Repair Order → Technician Status → Completion → Invoice", "An authorized shop can still create a Repair Order directly when appropriate"], metrics: [["Estimate • Demo", "$761"], ["Decision", "Approved"], ["RO status", "Waiting"]], flow: ["Estimate", "Approval", "Repair Order", "Status", "Completion", "Invoice"], records: ["Draft → Sent → Approved", "Waiting → In Progress → Completed", "Invoice • Unpaid record"] },
  { title: "Technician & Team Workflow", eyebrow: "Focused work, documented well", description: "Manage mechanics and office staff while technicians use shop-scoped PIN access for assigned Repair Orders, clock in/out, status updates, productivity context, payroll summaries, and required documentation.", bullets: ["Technician Portal with assigned jobs and real RO statuses", "Time tracking and payroll summaries without remittance claims", "Four exterior angles plus dashboard-condition photo"], metrics: [["Assigned", "3"], ["Clocked", "1h 42m"], ["Photos", "5 / 5"]], flow: ["Waiting", "In Progress", "Completed"], records: ["Front left exterior", "Front right exterior", "Rear left exterior", "Rear right exterior", "Dashboard condition"] },
  { title: "Invoices, Communication & Portal", eyebrow: "Review, delivery, and customer clarity", description: "Turn completed work into an in-context invoice, record payment and delivery history, and give customers a secure place for customer-safe records and communication.", bullets: ["Work & Line Items → Taxes & Totals → Review & Delivery", "Invoice signing, payment history, receipts, amount paid, and balance", "Portal widgets: Repair Orders → Estimates → Invoices → Appointments"], metrics: [["Invoice • Demo", "$761"], ["Amount paid • Demo", "$300"], ["Balance • Demo", "$461"]], flow: ["Completed", "Invoice", "History"], records: ["Print, PDF, and email delivery", "Customer-safe receipt access", "Secure messages • Internal data hidden"] },
  { title: "Parts, LBC AI Scanner & Assistance", eyebrow: "Inventory and professional scan context", description: "Connect parts inventory and vehicle/VIN lookup with the LBC AI Scanner, compatible OBD2 hardware, technician-reviewed DTC guidance, supported live data, reports, and contextual follow-up chat.", bullets: ["Scan, Live Data, and professional Tech Mode experiences", "VIN and mileage → approximately two-minute health workflow → report", "Save to Repair Order, Create Estimate, Print, and post-scan LBC Auto AI chat where supported"], metrics: [["Vehicle", "Identified"], ["DTCs • Demo", "2"], ["Report", "Ready"]], flow: ["Connect", "Identify", "Scan", "Report"], records: ["Vgate iCar Pro 2S BLE • Compatible target", "Readiness, DTC severity, and supported live snapshot", "AI assists; technician verifies"] }
];

export const flowStages = [
  ["Appointment / Walk-in", "Capture an online, phone, walk-in, or scheduled visit and the customer concern."],
  ["Customer & Vehicle", "Connect contact details, vehicle, VIN, mileage, photos, and prior history."],
  ["Estimate", "Build proposed labor, parts, taxes, totals, and recommendations before work starts."],
  ["Send", "Deliver the estimate for the customer’s review."],
  ["Approval / Decline", "Record the customer decision; approved estimates can convert into Repair Orders."],
  ["Repair Order", "Convert approved scope into assigned work. Authorized shops can also create an RO directly when appropriate."],
  ["Technician Work", "Move through Waiting, In Progress, or Waiting for Parts with time and photo documentation."],
  ["Completed Work", "Confirm the documented work is complete and ready to invoice."],
  ["Invoice & Delivery", "Review line items and totals, then record signing, payment, balance, receipt, and delivery details."],
  ["Customer History", "Preserve the connected customer, vehicle, estimate, RO, invoice, and service story." ]
];

export const proofItems = [
  ["Center Control", "Run an estimate-first day without chasing disconnected screens.", "Appointments, estimates, approvals, active Repair Orders, financial signals, and customer communication stay visible in one operating view."],
  ["Customer & Vehicle History", "Start every visit with better context.", "Mileage, photos, recommendations, contact records, and prior service follow the vehicle from intake to estimate and future history."],
  ["Estimates, Repair Orders & Invoices", "Keep approval before work in the normal path.", "Draft and send the estimate, capture approval or decline, convert approved scope to a Repair Order, complete work, then invoice."],
  ["Technician Portal", "Give technicians a focused view of approved work.", "Shop-scoped PIN access, assigned Repair Orders, time tracking, real job status, and required photo documentation support a consistent process."],
  ["Secure Customer Portal", "Keep customers informed without exposing shop operations.", "Verified activation and a customer-created passcode provide customer-safe access to Repair Orders, Estimates, Invoices, Appointments, receipts, and messages."],
  ["LBC AI Scanner & Assistance", "Bring professional scan context into technician-reviewed decisions.", "Use VIN and mileage, readiness, DTC and live-data context, reports, guidance, and post-scan chat without promising diagnosis or compatibility."]
];

export const statusGroups = [
  { label:"Estimate", items:[
    {label:"Draft",meaning:"Proposed labor, parts, taxes, and totals are being prepared.",actor:"Shop",next:"Send for customer review"},
    {label:"Sent",meaning:"The estimate has been delivered for a decision.",actor:"Customer",next:"Approve or decline"},
    {label:"Approved",meaning:"The customer accepted the proposed scope.",actor:"Shop",next:"Convert to Repair Order"},
    {label:"Declined",meaning:"The customer did not authorize the proposed scope.",actor:"Shop",next:"Revise, archive, or discuss options"},
    {label:"Expired",meaning:"The estimate passed its validity window.",actor:"Shop",next:"Review and issue updated pricing if needed"},
    {label:"Invoiced",meaning:"The estimate is connected to an invoice record.",actor:"Shop",next:"Track invoice and customer history"}
  ]},
  { label:"Repair Order", items:[
    {label:"Waiting",meaning:"Approved or directly created work is queued for the shop.",actor:"Technician",next:"Begin work and mark In Progress"},
    {label:"In Progress",meaning:"The technician is actively working and documenting the job.",actor:"Technician",next:"Complete work or mark Waiting for Parts"},
    {label:"Waiting for Parts",meaning:"Work is paused until required parts arrive.",actor:"Shop",next:"Receive parts and resume work"},
    {label:"Completed",meaning:"Documented technician work is finished.",actor:"Shop",next:"Create or review the invoice"},
    {label:"Delivered",meaning:"The completed vehicle has been returned to the customer.",actor:"Shop",next:"Preserve the final service history"}
  ]},
  { label:"Invoice", items:[
    {label:"Unpaid",meaning:"An invoice balance is recorded with no completed payment record.",actor:"Shop",next:"Record payment or follow the balance"},
    {label:"Partial",meaning:"A recorded payment covers part of the invoice total.",actor:"Shop",next:"Track and record the remaining balance"},
    {label:"Paid",meaning:"Recorded payments cover the invoice total.",actor:"Shop",next:"Issue receipt and retain history"},
    {label:"Overdue",meaning:"An unpaid balance has passed its due date.",actor:"Shop",next:"Follow up and update the payment record"}
  ]}
];