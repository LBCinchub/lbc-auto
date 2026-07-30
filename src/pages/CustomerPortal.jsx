import React, { useEffect, useState } from "react";
import PortalFrame from "@/components/customer-portal/PortalFrame";
import PortalLoginForm from "@/components/customer-portal/PortalLoginForm";
import PortalActivationForm from "@/components/customer-portal/PortalActivationForm";
import { clearPortalToken, getPortalToken, portalRequest, setPortalToken } from "@/lib/customerPortalApi";

const GENERIC_ERROR = "Invalid credentials or access unavailable";

export default function CustomerPortal() {
  const params = new URLSearchParams(window.location.search);
  const [mode, setMode] = useState("login");
  const [requested, setRequested] = useState(false);
  const [form, setForm] = useState({ shop: params.get("shop") || "", phone: "", passcode: "", code: "", newPasscode: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getPortalToken()) return;
    portalRequest("getCustomerPortalData", {}, true).then(() => { window.location.href = "/CustomerDashboard"; }).catch(() => clearPortalToken());
  }, []);

  const login = async (event) => {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const data = await portalRequest("secureCustomerLogin", { shop_identifier: form.shop, phone: form.phone, passcode: form.passcode });
      setPortalToken(data.token); window.location.href = "/CustomerDashboard";
    } catch { setError(`${GENERIC_ERROR}. After repeated attempts, wait 30 minutes before retrying.`); }
    setLoading(false);
  };

  const requestActivation = async (event) => {
    event.preventDefault(); setLoading(true); setError("");
    try { const data = await portalRequest("requestCustomerActivation", { shop_identifier: form.shop, phone: form.phone }); setRequested(true); setNotice(data.message); }
    catch { setNotice("If access is available, activation instructions will be provided through the configured channel."); setRequested(true); }
    setLoading(false);
  };

  const setup = async (event) => {
    event.preventDefault(); setLoading(true); setError("");
    try { await portalRequest("setupCustomerPasscode", { shop_identifier: form.shop, phone: form.phone, activation_code: form.code, new_passcode: form.newPasscode }); setMode("login"); setRequested(false); setNotice(""); setForm({ ...form, passcode: "", code: "", newPasscode: "" }); }
    catch { setError(GENERIC_ERROR); }
    setLoading(false);
  };

  return <PortalFrame>{mode === "login" ? <PortalLoginForm form={form} setForm={setForm} error={error} loading={loading} onSubmit={login} onActivate={() => { setMode("activate"); setError(""); }} /> : <PortalActivationForm form={form} setForm={setForm} requested={requested} error={error} notice={notice} loading={loading} onRequest={requestActivation} onSetup={setup} onBack={() => { setMode("login"); setError(""); }} />}</PortalFrame>;
}