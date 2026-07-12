import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { ONBOARDING_KEY } from "./onboardingStyles.jsx";
import StepWelcome from "./StepWelcome";
import StepShopProfile from "./StepShopProfile";
import StepFirstCustomer from "./StepFirstCustomer";
import StepFeatureTour from "./StepFeatureTour";
import StepReady from "./StepReady";

export default function OnboardingFlow({ user, onComplete }) {
  const [step, setStep] = useState(1);
  const [shopName, setShopName] = useState(user?.business_name || "");

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    onComplete();
  };

  const goNext = () => setStep((s) => Math.min(s + 1, 5));
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleShopProfileNext = () => {
    base44.auth.me().then((u) => {
      if (u?.business_name) setShopName(u.business_name);
      goNext();
    }).catch(() => goNext());
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.92)",
      backdropFilter: "blur(8px)",
      zIndex: 99999,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
    }}>
      {step === 1 && <StepWelcome onNext={goNext} />}
      {step === 2 && <StepShopProfile user={user} onNext={handleShopProfileNext} onBack={goBack} />}
      {step === 3 && <StepFirstCustomer onNext={goNext} onBack={goBack} />}
      {step === 4 && <StepFeatureTour onNext={goNext} onBack={goBack} />}
      {step === 5 && <StepReady shopName={shopName} onComplete={handleComplete} />}
    </div>
  );
}