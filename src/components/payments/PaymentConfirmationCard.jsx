import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import "./PaymentConfirmationCard.css";

// Customer-facing result card for card payment links (adapted "Confirmation Message" design).
export default function PaymentConfirmationCard({ tone = "success", heading, detail = [], action, continueTo = "/CustomerPortal", continueLabel = "Go to customer portal" }) {
  const [done, setDone] = useState(false);
  const buttonRef = useRef(null);
  const dotRef = useRef(null);
  const parts = detail.filter(Boolean);

  // The hover fill grows out of the dot, like the original design.
  const aimFill = () => {
    const button = buttonRef.current?.getBoundingClientRect();
    const dot = dotRef.current?.getBoundingClientRect();
    if (button && dot) buttonRef.current.style.setProperty("--pc-fx", `${dot.left + dot.width / 2 - button.left}px`);
  };
  const press = () => {
    action.onClick();
    if (action.doneLabel) setDone(true);
  };

  return (
    <section className="pc-section">
      <div className={`pc-icon-wrap pc-${tone}`} aria-hidden="true">
        {tone === "success"
          ? <svg className="pc-icon" viewBox="0 0 24 24"><polyline className="pc-check" points="5,12 10,17 19,7" /></svg>
          : <AlertTriangle className="pc-icon" strokeWidth={2.5} />}
      </div>
      <div className="pc-card">
        <h1 className="pc-heading">{heading}</h1>
        <p className="pc-detail">
          {parts.map((part, i) => <React.Fragment key={i}>{i > 0 && <span className="pc-sep">|</span>}{part}</React.Fragment>)}
        </p>
        <div className="pc-actions">
          {action && (
            <button ref={buttonRef} type="button" onMouseEnter={aimFill} onClick={press} aria-live="polite" className={`pc-primary${done ? " pc-done" : ""}`}>
              <span ref={dotRef} className="pc-dot" aria-hidden="true" />
              {done ? action.doneLabel : action.label}
            </button>
          )}
          <Link to={continueTo} className="pc-continue">{continueLabel}</Link>
        </div>
      </div>
    </section>
  );
}