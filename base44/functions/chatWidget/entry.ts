import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  // ── GET ?shop=email → return shop name JSON ──────────────────────
  const shopParam = url.searchParams.get("shop");
  if (req.method === "GET" && shopParam) {
    try {
      const base44 = createClientFromRequest(req);
      const sr = base44.asServiceRole;
      const shopUsers = await sr.entities.User.filter({ email: shopParam }, null, 1);
      const shop = shopUsers[0] || {};
      return Response.json(
        { shop_name: shop.business_name || "", shop_phone: shop.phone || "" },
        { headers: CORS }
      );
    } catch (e) {
      return Response.json({ shop_name: "", shop_phone: "" }, { headers: CORS });
    }
  }

  // ── GET (no params) → return embeddable JS script ─────────────────
  if (req.method === "GET") {
    const js = WIDGET_JS;
    return new Response(js, {
      headers: {
        ...CORS,
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS });
});

// ═══════════════════════════════════════════════════════════════════════════
// Embeddable Widget Script (vanilla JS — no dependencies)
// ═══════════════════════════════════════════════════════════════════════════
const WIDGET_JS = [
'(function(){',
'  var scripts = document.querySelectorAll("script[data-lbc-chat]");',
'  var scriptTag = scripts[scripts.length - 1];',
'  if (!scriptTag) return;',
'  var shopEmail = scriptTag.getAttribute("data-shop") || "";',
'  var shopName = scriptTag.getAttribute("data-shop-name") || "LBC Auto";',
'  var scriptSrc = scriptTag.getAttribute("src") || "";',
'  var origin = "https://lbchub.tech";',
'  try { origin = new URL(scriptSrc).origin; } catch(e){}',
'  var apiBase = origin + "/api/functions/";',
'',
'  function genId(){',
'    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){',
'      var r = Math.random()*16|0; return (c==="x"?r:(r&0x3|0x8)).toString(16);',
'    });',
'  }',
'',
'  var sessionId = genId();',
'  var open = false;',
'  var messages = [];',
'  var loading = false;',
'',
'  // Fetch shop name from account',
'  if (shopEmail) {',
'    fetch(apiBase + "chatWidget?shop=" + encodeURIComponent(shopEmail))',
'      .then(function(r){ return r.json(); })',
'      .then(function(d){ if (d.shop_name) { shopName = d.shop_name; updateHeader(); } })',
'      .catch(function(){});',
'  }',
'',
'  // Inject CSS',
'  var style = document.createElement("style");',
'  style.textContent = " \\',
'    @keyframes lbc-slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } } \\',
'    @keyframes lbc-dot-b { 0%,80%,100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1.0); opacity: 1; } } \\',
'    .lbc-w-fab { position: fixed; bottom: 20px; right: 20px; z-index: 99999; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #0a0f1e, #1e293b); border: 2px solid #0ea5e9; box-shadow: 0 0 16px rgba(14,165,233,0.4), 0 4px 20px rgba(0,0,0,0.4); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.2s; } \\',
'    .lbc-w-fab:hover { transform: scale(1.05); } \\',
'    .lbc-w-panel { position: fixed; bottom: 88px; right: 20px; z-index: 99999; width: 360px; max-width: calc(100vw - 40px); max-height: 540px; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.5); background: #0a0f1e; border: 1px solid rgba(14,165,233,0.2); display: none; flex-direction: column; animation: lbc-slide-up 0.25s ease-out; } \\',
'    .lbc-w-header { display: flex; align-items: center; gap: 10px; padding: 14px 16px; background: linear-gradient(135deg, #0a0f1e, #1e3a5f); border-bottom: 1px solid rgba(14,165,233,0.15); } \\',
'    .lbc-w-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; min-height: 280px; max-height: 380px; } \\',
'    .lbc-w-footer { padding: 6px 12px; text-align: center; font-size: 10px; color: #475569; background: #0f1729; border-top: 1px solid rgba(14,165,233,0.05); } \\',
'    .lbc-w-footer a { color: #0ea5e9; text-decoration: none; font-weight: 600; } \\',
'    .lbc-w-input-row { display: flex; align-items: center; gap: 8px; padding: 12px; border-top: 1px solid rgba(14,165,233,0.1); background: #0f1729; } \\',
'    .lbc-w-input { flex: 1; background: #1a2438; border: 1px solid rgba(14,165,233,0.3); border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #e2e8f0; outline: none; font-family: inherit; } \\',
'    .lbc-w-input::placeholder { color: #475569; } \\',
'    .lbc-w-input:focus { border-color: #0ea5e9; } \\',
'    .lbc-w-send { width: 38px; height: 38px; border-radius: 10px; background: #0ea5e9; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; } \\',
'    .lbc-w-send:hover { background: #38bdf8; } \\',
'    .lbc-w-send:disabled { opacity: 0.35; cursor: not-allowed; } \\',
'    .lbc-w-dot { width: 7px; height: 7px; border-radius: 50%; background: #38bdf8; display: inline-block; animation: lbc-dot-b 1.2s infinite ease-in-out; } \\',
'    .lbc-w-close { background: transparent; border: none; cursor: pointer; padding: 4px; } \\',
'    @media (max-width: 480px) { \\',
'      .lbc-w-panel { bottom: 0; right: 0; width: 100vw; max-width: 100vw; max-height: 100vh; border-radius: 0; border: none; } \\',
'      .lbc-w-fab { bottom: 16px; right: 16px; } \\',
'    }";',
'  document.head.appendChild(style);',
'',
'  // Create FAB',
'  var fab = document.createElement("button");',
'  fab.className = "lbc-w-fab";',
'  fab.innerHTML = "<svg width=\\"24\\" height=\\"24\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"#0ea5e9\\" stroke-width=\\"2\\"><path d=\\"M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z\\"/></svg>";',
'  fab.onclick = toggle;',
'  document.body.appendChild(fab);',
'',
'  // Create panel',
'  var panel = document.createElement("div");',
'  panel.className = "lbc-w-panel";',
'  panel.innerHTML = ' +
'    "<div class=\\"lbc-w-header\\">" +',
'      "<div style=\\"width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#3b82f6);display:flex;align-items:center;justify-content:center;flex-shrink:0\\">" +',
'        "<svg width=\\"18\\" height=\\"18\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"#fff\\" stroke-width=\\"2\\"><path d=\\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z\\"/></svg>" +',
'      "</div>" +',
'      "<div style=\\"flex:1;min-width:0\\">" +',
'        "<div id=\\"lbc-w-title\\" style=\\"color:#fff;font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\\">" + shopName + "</div>" +',
'        "<div style=\\"color:#38bdf8;font-size:11px\\">Powered by LBC Auto AI</div>" +',
'      "</div>" +',
'      "<button class=\\"lbc-w-close\\"><svg width=\\"18\\" height=\\"18\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"#64748b\\" stroke-width=\\"2\\"><line x1=\\"18\\" y1=\\"6\\" x2=\\"6\\" y2=\\"18\\"/><line x1=\\"6\\" y1=\\"6\\" x2=\\"18\\" y2=\\"18\\"/></svg></button>" +',
'    "</div>" +',
'    "<div class=\\"lbc-w-body\\" id=\\"lbc-w-body\\"></div>" +',
'    "<div class=\\"lbc-w-input-row\\">" +',
'      "<input class=\\"lbc-w-input\\" id=\\"lbc-w-input\\" placeholder=\\"Type your message\\u2026\\" />" +',
'      "<button class=\\"lbc-w-send\\" id=\\"lbc-w-send\\"><svg width=\\"16\\" height=\\"16\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"#fff\\" stroke-width=\\"2\\"><line x1=\\"22\\" y1=\\"2\\" x2=\\"11\\" y2=\\"13\\"/><polygon points=\\"22 2 15 22 11 13 2 9 22 2\\"/></svg></button>" +',
'    "</div>" +',
'    "<div class=\\"lbc-w-footer\\">Powered by <a href=\\"https://lbchub.tech\\" target=\\"_blank\\">LBC Auto AI</a></div>";',
'  document.body.appendChild(panel);',
'',
'  panel.querySelector(".lbc-w-close").onclick = toggle;',
'  var inputEl = panel.querySelector("#lbc-w-input");',
'  var sendBtn = panel.querySelector("#lbc-w-send");',
'  var bodyEl = panel.querySelector("#lbc-w-body");',
'  inputEl.addEventListener("keydown", function(e){ if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });',
'  sendBtn.onclick = send;',
'',
'  function updateHeader(){',
'    var titleEl = panel.querySelector("#lbc-w-title");',
'    if (titleEl) titleEl.textContent = shopName;',
'  }',
'',
'  function toggle(){',
'    open = !open;',
'    panel.style.display = open ? "flex" : "none";',
'    fab.innerHTML = open ' +
'      ? "<svg width=\\"24\\" height=\\"24\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"#fff\\" stroke-width=\\"2\\"><line x1=\\"18\\" y1=\\"6\\" x2=\\"6\\" y2=\\"18\\"/><line x1=\\"6\\" y1=\\"6\\" x2=\\"18\\" y2=\\"18\\"/></svg>"' +
'      : "<svg width=\\"24\\" height=\\"24\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"#0ea5e9\\" stroke-width=\\"2\\"><path d=\\"M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z\\"/></svg>";',
'    if (open) {',
'      if (messages.length === 0) {',
'        messages.push({ role: "assistant", content: "Hi! I\'m the AI assistant for " + shopName + ". How can I help you today? \\uD83D\\uDD27" });',
'        render();',
'      }',
'      setTimeout(function(){ inputEl.focus(); }, 150);',
'    }',
'  }',
'',
'  function render(){',
'    var html = "";',
'    for (var i = 0; i < messages.length; i++) {',
'      var m = messages[i];',
'      var isUser = m.role === "user";',
'      html += "<div style=\\"display:flex;justify-content:" + (isUser ? "flex-end" : "flex-start") + "\\">";',
'      html += "<div style=\\"max-width:82%;border-radius:12px;padding:10px 14px;font-size:13px;line-height:1.6;white-space:pre-wrap;";',
'      html += isUser ? "background:linear-gradient(135deg,#0ea5e9,#3b82f6);color:#fff;\\" " : "background:#1a2438;border:1px solid rgba(14,165,233,0.1);color:#cbd5e1;\\" ";',
'      html += ">" + escapeHtml(m.content) + "</div></div>";',
'    }',
'    if (loading) {',
'      html += "<div style=\\"display:flex\\"><div style=\\"background:#1a2438;border:1px solid rgba(14,165,233,0.1);border-radius:12px;padding:10px 16px;display:flex;gap:5px\\">";',
'      html += "<div class=\\"lbc-w-dot\\" style=\\"animation-delay:0ms\\"></div>";',
'      html += "<div class=\\"lbc-w-dot\\" style=\\"animation-delay:150ms\\"></div>";',
'      html += "<div class=\\"lbc-w-dot\\" style=\\"animation-delay:300ms\\"></div>";',
'      html += "</div></div>";',
'    }',
'    bodyEl.innerHTML = html;',
'    bodyEl.scrollTop = bodyEl.scrollHeight;',
'  }',
'',
'  function escapeHtml(s){',
'    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");',
'  }',
'',
'  function send(){',
'    var text = inputEl.value.trim();',
'    if (!text || loading) return;',
'    inputEl.value = "";',
'    var history = messages.slice();',
'    messages.push({ role: "user", content: text });',
'    loading = true;',
'    render();',
'',
'    fetch(apiBase + "handleChatMessage", {',
'      method: "POST",',
'      headers: { "Content-Type": "application/json" },',
'      body: JSON.stringify({',
'        shop_email: shopEmail,',
'        session_id: sessionId,',
'        customer_message: text,',
'        conversation_history: history.filter(function(m){ return m.role === "user" || m.role === "assistant"; }),',
'      }),',
'    })',
'    .then(function(r){ return r.json(); })',
'    .then(function(data){',
'      loading = false;',
'      var reply = data.reply || "I\'m sorry, I didn\'t catch that.";',
'      var booked = data.booking_made || false;',
'      messages.push({ role: "assistant", content: reply });',
'      if (booked) {',
'        messages.push({ role: "assistant", content: "\\u2705 You\'re all booked! The shop will see your appointment and reach out to confirm." });',
'      } else if (history.filter(function(m){ return m.role === "user"; }).length === 0) {',
'        messages.push({ role: "assistant", content: "Want me to book you an appointment? Just share your name and phone number. \\uD83D\\uDCC5" });',
'      }',
'      render();',
'    })',
'    .catch(function(){',
'      loading = false;',
'      messages.push({ role: "assistant", content: "\\u26A0\\uFE0F I\'m having trouble connecting right now. Please try again or call us directly." });',
'      render();',
'    });',
'  }',
'',
'})();',
].join('\n');