import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

// 16 numbered sections — (number, title, paragraphs[])
const SECTIONS = [
  [1, "Who We Are", [
    "LBC Network Inc. (\"LBC,\" \"we,\" \"us,\" or \"our\") is a Canadian company based in Ottawa, Ontario. We operate LBC Auto (AI-powered auto shop management software), LBC Hub, LBC AI tools, and associated services (the \"Services\").",
    "We serve customers across Canada, including Ontario and Québec (Gatineau), and internationally. This Privacy Policy explains how we collect, use, disclose, and protect personal information in accordance with the Personal Information Protection and Electronic Documents Act (PIPEDA), Québec's Act 25 (formerly Bill 64), and other applicable Canadian privacy laws.",
  ]],
  [2, "Personal Information We Collect", [
    "We may collect the following categories of personal information:",
    { list: [
      "Identity and Contact Information: Name, email address, phone number, physical address.",
      "Customer and Vehicle Information (via LBC Auto): Customer profiles, vehicle details (make, model, year, trim, engine, VIN, license plate, color), 4-angle exterior photos and dashboard condition photos, repair orders, estimates, invoices, appointments, service history.",
      "Account and Access Information: Shop administrator details, technician PINs, customer activation codes (6-digit, 10-minute expiry), salted and hashed passcodes created by customers for the Customer Portal. We do not store, log, or transmit plaintext passcodes.",
      "Transactional and Financial Information: Payment records, billing details, and Solana / $LBC token transactions (wallet addresses, transaction hashes, amounts). Note: On-chain Solana transactions are publicly visible on the blockchain by design and cannot be reversed, deleted, or modified.",
      "Technical and Usage Data: IP address, device information, log data, browser type, interactions with our websites, portals, and AI features.",
      "Communications: Messages between shops and customers, chat conversations through LBC AI, support inquiries, booking pipeline messages from shop websites.",
      "AI Interaction Data: Inputs provided to LBC AI features (booking requests, pricing inquiries, diagnostic descriptions), AI-generated responses, and usage patterns used to improve AI quality and relevance.",
    ]},
    "We do not intentionally collect sensitive personal information (e.g., health data, biometric data, or government ID numbers) beyond what is necessary for vehicle service records unless required by law or explicitly provided. We do not knowingly collect personal information from individuals under 18 without parental or guardian consent.",
  ]],
  [3, "How We Collect Personal Information", [
    { list: [
      "Directly from you or your authorized representatives when you create an account, use the Customer Portal, book services through a shop's website, or contact us.",
      "From auto shops using LBC Auto (shop-scoped customer and vehicle data, tenant-isolated per shop).",
      "Automatically through cookies, logs, and similar technologies when you use our websites or Services.",
      "From third-party service providers (e.g., payment processors, hosting providers, Solana blockchain) as needed to deliver the Services.",
    ]},
    "Customer Portal access uses a shop-issued secure activation code followed by a customer-created salted and hashed passcode. We do not store plaintext passcodes. After 5 failed login attempts, the account is locked.",
  ]],
  [4, "Purposes for Collection and Use", [
    "We collect and use personal information only for purposes that a reasonable person would consider appropriate, including:",
    { list: [
      "Providing and operating the Services (shop management, appointments, estimates, invoices, AI assistance, Customer Portal).",
      "Authenticating users and enforcing strict per-shop (tenant) data isolation. One shop's customer data is never accessible to another shop.",
      "Processing payments, including Solana-based $LBC token transactions.",
      "Operating AI features: booking pipeline automation, pricing suggestions, diagnostic support, and chat assistance. AI processing occurs server-side with appropriate safeguards. Personal data is not used to train external AI models. You may opt out of AI-assisted features by contacting us — this may limit some functionality.",
      "Communicating with you about your account, services, or support.",
      "Improving our Services, user experience, and AI quality (with data processed under appropriate safeguards, never sold or shared with third-party model providers).",
      "Ensuring security, preventing fraud, and complying with legal obligations.",
      "Other purposes with your consent or as permitted/required by law.",
    ]},
  ]],
  [5, "Consent", [
    "We obtain consent for the collection, use, and disclosure of personal information, except where PIPEDA or Québec's Act 25 permits otherwise (e.g., legal requirements or certain emergencies).",
    "For sensitive personal information, we obtain express consent. For less sensitive information, consent may be implied from your use of the Services.",
    "You may withdraw consent at any time, subject to legal or contractual restrictions and reasonable notice. Withdrawal may affect our ability to provide certain Services.",
    "Note for Québec residents (Act 25 compliance): We have designated a Privacy Officer (see Section 12). We conduct privacy impact assessments for new projects or technologies that involve personal information. We do not use personal information for automated decision-making without appropriate safeguards and your knowledge.",
  ]],
  [6, "Disclosure of Personal Information", [
    "We do not sell personal information. We may disclose personal information only:",
    { list: [
      "To service providers who assist us (hosting, payment processing, analytics, support) under contractual obligations to protect the information.",
      "Within a shop's isolated environment to authorized shop staff and technicians as needed to deliver services.",
      "When required or permitted by law (e.g., court order, regulatory request).",
      "In connection with a business transaction (e.g., merger or sale), with appropriate protections.",
      "With your consent.",
    ]},
    "We maintain strict multi-tenant isolation so that one shop's customer data is not accessible to other shops. All service providers are bound by contractual obligations to protect personal information and are prohibited from using it for their own purposes.",
  ]],
  [7, "Cross-Border Transfers", [
    "Personal information may be processed or stored outside Canada (including by cloud infrastructure providers in the United States). When we transfer personal information outside Canada, we use contractual or other means to provide a comparable level of protection. Information stored or processed outside Canada may be subject to the laws of those jurisdictions.",
    "On-chain Solana / $LBC transactions are publicly visible on the blockchain by design. Wallet addresses, transaction amounts, and timestamps are permanently recorded on the Solana blockchain and cannot be deleted or modified. We do not store private keys or seed phrases on our servers.",
  ]],
  [8, "Retention", [
    "We retain personal information only as long as necessary to fulfill the purposes for which it was collected, to meet legal or regulatory requirements, or to resolve disputes. When no longer needed, we securely destroy, anonymize, or aggregate the information.",
    "Vehicle service records (repair orders, estimates, invoices, photos) are retained for the duration of the shop's active subscription plus 7 years for legal/audit purposes, unless a longer period is required by law.",
    "On-chain blockchain data (Solana / $LBC transactions) cannot be deleted by nature of blockchain technology — this is a fundamental limitation. We do not control or modify blockchain data once a transaction is confirmed.",
  ]],
  [9, "Safeguards", [
    "We implement physical, organizational, and technical safeguards appropriate to the sensitivity of the information, including:",
    { list: [
      "Encryption in transit and at rest.",
      "Salted and hashed passcodes (never stored in plaintext).",
      "Strict per-shop data isolation and role-based access controls.",
      "Server-side AI processing with permissions, audit trails, and rate limiting.",
      "Regular security reviews and access monitoring.",
      "5-attempt lockout for Customer Portal access.",
      "Short-lived, revocable customer sessions with per-request validation.",
    ]},
    "No method of transmission or storage is 100% secure. We cannot guarantee absolute security.",
  ]],
  [10, "Data Breach Response", [
    "In the event of a privacy breach involving personal information that poses a real risk of significant harm to affected individuals, we will:",
    { list: [
      "Assess and contain the breach promptly.",
      "Notify affected individuals and the appropriate regulatory authorities (including the Office of the Privacy Commissioner of Canada and the Commission d'accès à l'information du Québec) as required by PIPEDA and Québec's Act 25.",
      "Document the breach, remediation steps, and preventive measures.",
    ]},
  ]],
  [11, "Access, Correction, and Your Rights", [
    "Subject to limited exceptions under PIPEDA and Québec's Act 25, you have the right to:",
    { list: [
      "Request access to the personal information we hold about you.",
      "Request correction of inaccurate or incomplete information.",
      "Withdraw consent (where applicable).",
      "Challenge our compliance with this Policy.",
      "Request information about how your personal information has been used or disclosed.",
    ]},
    "To exercise these rights, contact us using the details in Section 12. We will respond within the timeframes required by law (generally 30 days under PIPEDA, 30 days under Act 25).",
  ]],
  [12, "Accountability", [
    "We are responsible for personal information under our control.",
    { card: [
      { label: "Privacy Officer", value: "Mokhtar Tarek Samara" },
      { label: "Company", value: "LBC Network Inc." },
      { label: "Location", value: "Ottawa, Ontario, Canada" },
      { label: "Email", value: "tarek-samara@lbc-hub.com", href: "mailto:tarek-samara@lbc-hub.com" },
      { label: "Phone", value: "613-314-1994" },
    ]},
    "We also serve customers in the National Capital Region, including Gatineau, Québec, and comply with Québec's Act 25 privacy requirements.",
  ]],
  [13, "Cookies and Tracking Technologies", [
    "We use cookies and similar technologies on our websites to operate and improve our Services. We use:",
    { list: [
      "Essential cookies (required for the Services to function).",
      "Analytics cookies (to understand how visitors use our websites).",
      "Preference cookies (remember your settings).",
    ]},
    "You can manage cookie preferences through your browser settings. We do not use cookies for targeted advertising or sell cookie-derived data to third parties.",
  ]],
  [14, "Changes to This Policy", [
    "We may update this Privacy Policy from time to time. The \"Last Updated\" date will reflect changes. Material changes will be communicated through our website or directly to affected users. Continued use of the Services after changes constitutes acceptance of the updated Policy where permitted by law.",
  ]],
  [15, "Complaints", [
    "If you have concerns about our privacy practices, please contact us first. You may also file a complaint with the appropriate privacy authority:",
    { card: [
      { label: "Office of the Privacy Commissioner of Canada", value: ["30 Victoria Street", "Gatineau, Quebec K1A 1H3", "Website: HTTPS://WWW.PRIV.GC.CA", "Toll-free: 1-800-282-1376"] },
      { label: "Commission d'accès à l'information du Québec", value: ["Édifice Hydro-Québec", "800 Place Victoria, 3e étage", "Montréal, Québec H2C 2P5", "Website: HTTPS://WWW.CAI.GOUV.QC.CA"] },
    ]},
  ]],
  [16, "Contact Us", [
    "For questions about this Privacy Policy or our privacy practices:",
    { card: [
      { label: "Email", value: "tarek-samara@lbc-hub.com", href: "mailto:tarek-samara@lbc-hub.com" },
      { label: "Phone", value: "613-314-1994" },
      { label: "Address", value: "LBC Network Inc., Ottawa, Ontario, Canada" },
    ]},
    { list: [
      "For customer portal support: HTTPS://LBC-HUB.COM/SERVICES",
      "For LBC Auto inquiries: HTTPS://LBCHUB.TECH",
      "For general inquiries: HTTPS://LBC.NETWORK",
    ]},
  ]],
];

export default function PrivacyPolicy() {
  return (
    <div className="lp-pp-page">
      <div className="lp-pp-wrap">
        <header className="lp-pp-head">
          <h1 className="lp-pp-title">Privacy Policy</h1>
          <p className="lp-pp-company">LBC Network Inc.</p>
          <div className="lp-pp-meta">
            <span>Effective Date: August 12, 2026</span>
            <span aria-hidden="true">·</span>
            <span>Last Updated: August 12, 2026</span>
          </div>
        </header>

        <article className="lp-pp-body">
          {SECTIONS.map(([num, title, blocks]) => (
            <section key={num} className="lp-pp-sec">
              <div className="lp-pp-sec-head">
                <span className="lp-pp-num">{num}.</span>
                <h2 className="lp-pp-sec-title">{title}</h2>
              </div>
              <div className="lp-pp-sec-body">
                {blocks.map((b, i) => b.list ? (
                  <ul key={i} className="lp-pp-list">
                    {b.list.map((li, j) => (
                      <li key={j}>{renderLine(li)}</li>
                    ))}
                  </ul>
                ) : b.card ? (
                  <div key={i} className="lp-pp-cards">
                    {b.card.map((c, k) => (
                      <div key={k} className="lp-pp-card">
                        <div className="lp-pp-card-label">{c.label}</div>
                        {Array.isArray(c.value) ? c.value.map((v, m) => (
                          <div key={m} className="lp-pp-card-val">{renderLine(v)}</div>
                        )) : (
                          <div className="lp-pp-card-val">
                            {c.href ? <a href={c.href} className="lp-pp-link">{c.value}</a> : c.value}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p key={i} className="lp-pp-p">{renderLine(b)}</p>
                ))}
              </div>
            </section>
          ))}
        </article>

        <div className="lp-pp-back">
          <Link to="/" className="lp-pp-back-btn">
            <ArrowLeft size={16} /> Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

// Render a paragraph/li string, highlighting leading "Label:" segment.
function renderLine(text) {
  const m = text.match(/^([A-Z][A-Za-z .,&()/'-]+?):\s+(.*)$/s);
  if (m) return (<><strong className="lp-pp-lead">{m[1]}:</strong> {m[2]}</>);
  return text;
}