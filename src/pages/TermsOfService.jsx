import React from "react";
import LegalDocument from "@/components/legal/LegalDocument";

// Numbered sections — (number, title, blocks[]); same format as the Privacy Policy.
const SECTIONS = [
  [1, "Agreement to These Terms", [
    "These Terms of Service (\"Terms\") govern access to and use of LBC Auto and its related websites, portals, and services (the \"Services\"), provided by LBC Network Inc. (\"LBC,\" \"we,\" \"us,\" or \"our\"), a Canadian company based in Ottawa, Ontario.",
    "By creating an account, starting a free trial, or using the Services, you agree to these Terms on behalf of yourself and the shop or business you represent (the \"Shop\"). If you do not agree, do not use the Services.",
  ]],
  [2, "Accounts and Access", [
    "You must provide accurate account information and keep it up to date.",
    "Keep sign-in credentials, technician PINs, and customer activation codes confidential. The Shop is responsible for activity under its account, including the access it gives to staff and technicians.",
    "Tell us promptly if you believe your account has been accessed without permission.",
  ]],
  [3, "Free Trial, Plans, and Fees", [
    "New shops can try LBC Auto free for 7 days. No payment is needed to start the trial.",
    "Continued access after the trial requires the one-time Setup & Training fee and a monthly Basic or Pro plan. Current fees are shown on our pricing page and at checkout, and applicable taxes are added where required.",
    "LBC AI Diagnostics is part of the Pro plan.",
  ]],
  [4, "Billing, Renewal, and Cancellation", [
    "Monthly plans renew automatically each billing period until cancelled. Payments are processed by our third-party payment provider.",
    "If a renewal payment is not completed, access to the Services may be paused until payment is made.",
    "You may cancel at any time. Access continues until the end of the period already paid for.",
    "We may change fees with reasonable advance notice. Changes apply from the next billing period.",
  ]],
  [5, "Your Shop Data", [
    "The Shop owns the customer, vehicle, and business records it adds to the Services (\"Shop Data\").",
    "You give us permission to host, process, and display Shop Data only as needed to provide, secure, support, and improve the Services. Each shop's records are kept in its own isolated workspace.",
    "You are responsible for having the right to collect and use the personal information you add, including any consent your customers must give. Our Privacy Policy explains how we handle personal information.",
  ]],
  [6, "Acceptable Use", [
    "You agree not to:",
    { list: [
      "Use the Services for anything unlawful, fraudulent, or harmful.",
      "Try to access another shop's data or get around security, access controls, or usage limits.",
      "Send spam or messages your customers have not agreed to receive.",
      "Upload malicious code or disrupt the operation of the Services.",
      "Copy, resell, reverse engineer, or sublicense the Services without our written permission.",
    ]},
  ]],
  [7, "AI Features and Diagnostics", [
    "LBC AI features, including the LBC AI Scanner and the LBC Auto AI assistant, provide assistance only. Diagnostic suggestions, DTC guidance, estimates, and pricing suggestions may be incomplete or inaccurate.",
    "A qualified technician must review AI output before any repair, quote, or customer communication. Vehicle compatibility, live-data availability, and ECU commands depend on the vehicle and the adapter, and are not guaranteed.",
  ]],
  [8, "Customer Communications", [
    "Estimates, invoices, reminders, and messages sent through the Services are sent on behalf of the Shop. The Shop is responsible for their content and for following the laws that apply to its customer communications, including Canada's Anti-Spam Legislation (CASL).",
  ]],
  [9, "Third-Party Services", [
    "Some features rely on third-party providers, such as hosting, payment processing, email, and text messaging. Their terms may also apply when you use those features, and we are not responsible for services outside our control.",
  ]],
  [10, "Availability and Changes to the Services", [
    "We work to keep the Services available and secure, but we do not guarantee uninterrupted or error-free operation. We may add, change, or remove features as the Services improve.",
  ]],
  [11, "Disclaimers and Limitation of Liability", [
    "To the extent permitted by law, the Services are provided \"as is\" and \"as available,\" without warranties of any kind.",
    "To the maximum extent permitted by law, LBC is not liable for indirect, incidental, special, or consequential damages, or for lost profits, revenue, or data. Our total liability for any claim relating to the Services is limited to the amount the Shop paid us in the 12 months before the claim.",
  ]],
  [12, "Suspension and Termination", [
    "We may suspend or end access if these Terms are breached, fees are unpaid, or use of the Services puts their security or other shops at risk.",
    "The Shop may stop using the Services at any time. Records are retained as described in our Privacy Policy, and you may contact us to request a copy of your Shop Data.",
  ]],
  [13, "Governing Law", [
    "These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada that apply there. Disputes will be resolved in the courts of Ottawa, Ontario, unless applicable law requires otherwise.",
  ]],
  [14, "Changes to These Terms", [
    "We may update these Terms from time to time. The \"Last Updated\" date shows the current version, and we will communicate material changes through the Services or by email. Continued use after changes take effect means you accept the updated Terms.",
  ]],
  [15, "Contact Us", [
    "Questions about these Terms:",
    { card: [
      { label: "Email", value: "tarek-samara@lbc-hub.com", href: "mailto:tarek-samara@lbc-hub.com" },
      { label: "Phone", value: "613-314-1994" },
      { label: "Address", value: "LBC Network Inc., Ottawa, Ontario, Canada" },
    ]},
  ]],
];

export default function TermsOfService() {
  return <LegalDocument title="Terms of Service" company="LBC Network Inc." effective="November 1, 2026" updated="November 1, 2026" sections={SECTIONS} />;
}