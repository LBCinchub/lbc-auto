// Evidence-based capability coverage: every data module in the app is either reachable through a
// named, role-gated capability, or listed as unavailable with the reason. A test cross-checks this
// against the entity files and the registry, so a new module cannot silently fall outside it.
export const COVERAGE: any[] = [
  { module: 'Customers', entities: ['Customer'], capabilities: ['customers.search', 'customers.get', 'customers.create', 'customers.update'] },
  { module: 'Vehicles & Service History', entities: ['Vehicle'], capabilities: ['vehicles.search', 'vehicles.history', 'vehicles.create', 'vehicles.update'] },
  { module: 'Appointments', entities: ['Appointment'], capabilities: ['appointments.list', 'appointments.create', 'appointments.update'] },
  { module: 'Estimates', entities: ['Estimate'], capabilities: ['estimates.list', 'estimates.get', 'estimates.create'] },
  { module: 'Repair Orders & Technician Work', entities: ['RepairOrder'], capabilities: ['repair_orders.list', 'repair_orders.get', 'repair_orders.update_status'] },
  { module: 'Invoices & Balances', entities: ['Invoice'], capabilities: ['invoices.list', 'invoices.get', 'customers.balance'] },
  { module: 'Reporting', entities: ['Expense'], capabilities: ['reports.summary', 'expenses.list'] },
  { module: 'Parts, Inventory & Suppliers', entities: ['Part'], capabilities: ['parts.search', 'parts.low_stock', 'suppliers.list', 'parts.update_stock'] },
  { module: 'Price Library', entities: ['LineItemLibrary'], capabilities: ['price_library.search'] },
  { module: 'Team', entities: ['Mechanic'], capabilities: ['team.list'] },
  { module: 'Time Tracking', entities: ['TimeEntry'], capabilities: ['time.summary'] },
  { module: 'Payroll', entities: ['PaymentRecord'], capabilities: ['payroll.list'] },
  { module: 'Settings & Shop Profile', entities: ['User'], capabilities: ['settings.get', 'shop.public_info'] },
  { module: 'Customer Messages', entities: ['ChatMessage', 'CustomerMessage'], capabilities: ['messages.inbox', 'portal_messages.inbox'] },
  { module: 'Diagnostics', entities: ['DiagnosticScan'], capabilities: ['diagnostics.list'] },
  { module: 'Vehicle Photos', entities: ['VehiclePhoto'], capabilities: ['photos.list'] },
  { module: 'Reviews', entities: ['CustomerReview'], capabilities: ['reviews.list'] },
  { module: 'Offers', entities: ['ShopOffer'], capabilities: ['offers.list'] },
  { module: 'Recommendations', entities: ['CarRecommendation'], capabilities: ['recommendations.list'] },
  { module: 'Notes', entities: ['Note'], capabilities: ['notes.list'] },
  { module: 'Card Payments & Stripe', entities: ['ShopStripeAccount', 'StripeCheckoutLink'], unavailable: 'Payments, refunds and Stripe keys stay on the invoice and settings screens; money is never moved from chat.' },
  { module: 'Document Texting', entities: ['DocumentDelivery'], unavailable: 'Texts and emails are sent from the Send buttons on each document.' },
  { module: 'Alignment Lab', entities: ['AlignmentMachine', 'AlignmentMeasurement', 'AlignmentSession', 'AlignmentReport', 'CalibrationRecord', 'MachineProfile', 'RecoveryCase'], unavailable: 'Alignment Lab data is used in the Alignment screen only.' },
  { module: 'Customer Portal Security', entities: ['CustomerPasscode', 'CustomerPortalSession', 'PortalActivationCode', 'CustomerSecurityEvent', 'PortalOwnershipQuarantine', 'PortalOwnershipResolution'], unavailable: 'Login codes, sessions and security events are never exposed to chat.' },
  { module: 'Customer Notifications', entities: ['CustomerNotification'], unavailable: 'Customer notifications are managed from the customer profile.' },
  { module: 'Website Booking Setup', entities: ['ShopBookingAlias', 'WebBookingKey', 'WebBookingReceipt'], unavailable: 'Website keys and booking receipts are credentials and are never exposed to chat.' },
  { module: 'Internal Audit', entities: ['StaffAssistantAction', 'FinancialWorkflowEvent'], unavailable: 'Internal audit records are not shown in chat.' },
  { module: 'Quick Note Shortcuts', entities: ['ShopQuickNote'], unavailable: 'Quick note shortcuts are editor buttons, managed in Settings.' },
];

export const coverageReply = () => `I can't do that from chat. I can look up ${COVERAGE.filter((c) => c.capabilities).map((c) => c.module).join(', ')}; and create or update customers, vehicles, appointments and draft estimates (after you confirm).`;