import React from "react";
import { cardStyle, btnPrimary, btnSecondary, ProgressBar } from "./onboardingStyles.jsx";

const GUIDE_ITEMS = [
  { n: "1️⃣", title: "CREATE YOUR FIRST ESTIMATE", desc: "Go to Estimates → New Estimate. Add customer → vehicle → services → send" },
  { n: "2️⃣", title: "CASH OUT AN ESTIMATE", desc: "Open any estimate → click Cash Out. All line items carry over automatically ✓" },
  { n: "3️⃣", title: "SCAN A VEHICLE", desc: "Go to LBC AUTO AI SCANNER (Pro). Connect Vgate BLE → Full Scan → AI Diagnosis" },
  { n: "4️⃣", title: "YOUR AI BOOKING LINK", desc: "Share this with customers. They chat, AI books them, you get notified" },
  { n: "5️⃣", title: "NEED HELP?", desc: "📞 LBC Support: 613-314-1994  📧 tarek-samara@lbc-hub.com" },
];

function buildPrintHTML(shopSlug) {
  return `<!DOCTYPE html><html><head><title>LBC AUTO — Quick Start Guide</title>
<style>
body{font-family:'Courier New',monospace;background:#fff;color:#000;padding:40px;max-width:680px;margin:0 auto;line-height:1.7;font-size:13px;}
hr{border:none;border-top:2px solid #000;margin:12px 0;}
h1{text-align:center;font-size:20px;margin:0 0 4px;}
.sub{text-align:center;color:#555;font-size:13px;margin-bottom:12px;}
.step{margin:10px 0;padding-left:8px;}
.step-title{font-weight:bold;font-size:14px;}
.step-body{color:#333;padding-left:20px;}
.support{margin-top:20px;text-align:center;font-size:12px;}
.support strong{color:#000;}
@media print{body{padding:20px;}}
</style></head><body>
<hr><h1>⚡ LBC AUTO — QUICK START GUIDE</h1><hr>
<div class="step"><div class="step-title">① CREATE AN ESTIMATE</div><div class="step-body">Dashboard → Estimates → + New Estimate<br>• Search or add customer<br>• Add vehicle<br>• Add labor items (hours × rate) and parts<br>• Click Send to Customer or Convert to Invoice</div></div>
<div class="step"><div class="step-title">② CASH OUT / INVOICE</div><div class="step-body">Open any estimate → Cash Out button<br>All your written items carry over automatically.<br>Choose cash / card → amount paid → Done.</div></div>
<div class="step"><div class="step-title">③ REPAIR ORDERS</div><div class="step-body">Dashboard → Repair Orders → + New RO<br>Link to existing estimate or start fresh.<br>Assign mechanic, track status: Waiting → In Progress → Delivered</div></div>
<div class="step"><div class="step-title">④ LBC AUTO AI SCANNER (Pro)</div><div class="step-body">Dashboard → LBC AUTO AI SCANNER<br>• Connect Vgate iCar Pro 2S via Bluetooth<br>• SCAN MODE: Full system scan + AI diagnosis<br>• LIVE DATA: 16 sensors streaming live<br>• TECH MODE: Type "o2 reading", "caliper test", etc.</div></div>
<div class="step"><div class="step-title">⑤ CUSTOMER AI CHAT</div><div class="step-body">Your customers visit: lbchub.ink/${shopSlug}<br>They chat with your AI → AI quotes prices → AI books appointments<br>You see all chats in Dashboard → Chat Inbox</div></div>
<div class="step"><div class="step-title">⑥ VEHICLE PHOTOS</div><div class="step-body">AI Chat or Scanner → take/upload photo<br>AI analyzes it → Save to Customer Profile<br>Customer Profile → Print Report → full history with photos</div></div>
<hr><div class="support"><strong>📞 613-314-1994</strong>&nbsp;&nbsp;&nbsp;<strong>📧 tarek-samara@lbc-hub.com</strong><br><strong>🌐 lbchub.tech</strong>&nbsp;&nbsp;&nbsp;Powered by LBC AUTO</div><hr>
</body></html>`;
}

export default function StepReady({ shopName, onComplete }) {
  const shopSlug = (shopName || "yourshop").toLowerCase().replace(/[^a-z0-9]/g, "");

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(buildPrintHTML(shopSlug));
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 300);
    }
  };

  return (
    <div style={cardStyle}>
      <div style={{ padding: "28px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <h2 style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 800, margin: 0 }}>You're All Set!</h2>
        </div>
        <span style={{ color: "#475569", fontSize: 12 }}>Step 5 of 5</span>
        <ProgressBar step={5} />

        <div style={{ textAlign: "center", margin: "16px 0" }}>
          <span style={{ fontSize: 28 }}>🎉</span>
          <p style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 600, margin: "8px 0 0" }}>
            {shopName || "Your shop"} is ready to go on LBC AUTO
          </p>
        </div>

        <p style={{ color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 12 }}>
          Your Quick Start Guide
        </p>

        {GUIDE_ITEMS.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, paddingLeft: 4 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{item.n}</span>
            <div>
              <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 700 }}>{item.title}</div>
              <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={handlePrint} style={{ ...btnSecondary, flex: 1, justifyContent: "center" }}>📄 DOWNLOAD QUICK START PDF</button>
          <button onClick={handlePrint} style={{ ...btnSecondary, flex: 1, justifyContent: "center" }}>🖨️ PRINT THIS GUIDE</button>
        </div>

        <button onClick={onComplete} style={{ ...btnPrimary, width: "100%", marginTop: 16, justifyContent: "center" }}>
          🚀 GO TO MY DASHBOARD
        </button>
      </div>
    </div>
  );
}