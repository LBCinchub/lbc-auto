import React from "react";
import { CheckCircle2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const ANNOUNCEMENT_KEY = "v20260801_customer_dashboard";
export default function Announcement({ open, onClose }) {
  return <Dialog open={open} onOpenChange={() => {}}><DialogContent className="cd-modal cd-announcement" onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}><DialogHeader><span className="cd-announcement-icon"><CheckCircle2 /></span><DialogTitle>Your garage, clearer than ever</DialogTitle><DialogDescription>Select a vehicle, check service updates, review documents, and message your shop from one secure dashboard.</DialogDescription></DialogHeader><button className="cd-primary-button" onClick={onClose}>Explore my dashboard</button><button className="cd-secondary-button" onClick={onClose}><X />Close</button></DialogContent></Dialog>;
}