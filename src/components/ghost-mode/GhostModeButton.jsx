import React, { useState } from "react";
import { Ghost } from "lucide-react";
import { Button } from "@/components/ui/button";
import GhostSplitDialog from "./GhostSplitDialog";

// Drop-in action-bar button that opens the split dialog.
// Renders only when the document has no ghost yet (parent decides).
export default function GhostModeButton({ lineItems, taxRate, taxAppliesTo, onSplit, disabled, label = "Ghost Mode", initialRemaining }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={disabled || !lineItems || lineItems.length === 0}
        className="gap-2 border-gray-700 text-gray-300 hover:text-white"
        title="Split work into Done Now + Remaining (Ghost)"
      >
        <Ghost className="w-4 h-4" /> {label}
      </Button>
      <GhostSplitDialog
        open={open}
        onClose={() => setOpen(false)}
        lineItems={lineItems}
        taxRate={taxRate}
        taxAppliesTo={taxAppliesTo}
        initialRemaining={initialRemaining}
        onConfirm={(payload) => {
          onSplit(payload);
          setOpen(false);
        }}
      />
    </>
  );
}