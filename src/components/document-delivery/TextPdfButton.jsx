import React, { useState } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import TextPdfDialog from "./TextPdfDialog";

export default function TextPdfButton({ documentType, documentId, className = "h-8 w-8", iconClassName = "w-4 h-4" }) {
  const [open, setOpen] = useState(false);
  return (
    // Clicks inside the window must not reach the document row underneath (React portals bubble).
    <span className="contents" onClick={(e) => e.stopPropagation()}>
      <Button variant="ghost" size="icon" className={`${className} text-gray-500 hover:text-sky-400`} title="Text PDF to customer"
        aria-label="Text PDF to customer" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        <Smartphone className={iconClassName} />
      </Button>
      {open && <TextPdfDialog documentType={documentType} documentId={documentId} onClose={() => setOpen(false)} />}
    </span>
  );
}