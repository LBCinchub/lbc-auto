import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { ONBOARDING_KEY } from "./onboardingStyles.jsx";
import StepWelcome from "./StepWelcome";
import StepShopProfile from "./StepShopProfile";
import StepFirstCustomer from "./StepFirstCustomer";
import StepFeatureTour from "./StepFeatureTour";
import StepReady from "./StepReady";

const EMPTY_CUSTOMER = { name: "", phone: "", email: "", address: "", year: "", make: "", model: "", color: "", plate: "", vin: "" };

export default function OnboardingFlow({ user, onComplete }) {
  const [step, setStep] = useState(1);
  const [shopName, setShopName] = useState(user?.business_name || "");
  // Kept here, not in the steps, so going Back/Next never loses entered or saved data.
  const [profileUser, setProfileUser] = useState(user);
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER);
  const [savedCustomer, setSavedCustomer] = useState({ customerId: "", vehicleId: "" });
  const markCustomerSaved = (patch) => setSavedCustomer((s) => ({ ...s, ...patch }));

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    onComplete();
  };

  const goNext = () => setStep((s) => Math.min(s + 1, 5));
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleShopProfileNext = () => {
    base44.auth.me().then((u) => {
      if (u) setProfileUser(u);
      if (u?.business_name) setShopName(u.business_name);
      goNext();
    }).catch(() => goNext());
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.92)",
      zIndex: 99999,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
    }}>
      {step === 1 && <StepWelcome onNext={goNext} />}
      {step === 2 && <StepShopProfile user={profileUser} onNext={handleShopProfileNext} onBack={goBack} />}
      {step === 3 && (
        <StepFirstCustomer
          form={customerForm}
          onFormChange={setCustomerForm}
          saved={savedCustomer}
          onSaved={markCustomerSaved}
          onNext={goNext}
          onBack={goBack}
        />
      )}
      {step === 4 && <StepFeatureTour onNext={goNext} onBack={goBack} />}
      {step === 5 && <StepReady shopName={shopName} onComplete={handleComplete} />}
    </div>
  );
}