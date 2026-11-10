import React, { useState } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import TextPdfDialog from "./TextPdfDialog";

// Opens the document text window: "Send PDF" (attachment) or "Send As Text" (readable details).
// Neither option ever sends a link.
export default function TextPdfButton({ documentType, documentId, size = "sm", className = "" }) {
  const [open, setOpen] = useState(false);
  const label = documentType === "invoice" ? "Text Invoice" : "Text Estimate";
  return (
    // Clicks inside the window must not reach the document row underneath (React portals bubble).
    <span className="contents" onClick={(e) => e.stopPropagation()}>
      <Button variant="outline" size={size} className={`border-gray-700 bg-transparent text-sky-300 hover:text-sky-200 ${className}`}
        title={`${label}: send the PDF or the details as text, no link`} onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        <Smartphone /> {label}
      </Button>
      {open && <TextPdfDialog documentType={documentType} documentId={documentId} onClose={() => setOpen(false)} />}
    </span>
  );
}