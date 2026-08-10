import React from "react";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function PortalAnnouncement({ open, onClose }) {
  return <Dialog open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="portal-dialog max-w-md" onInteractOutside={(event) => event.preventDefault()} onEscapeKeyDown={(event) => event.preventDefault()}>
      <DialogHeader>
        <div className="portal-icon-box mb-3"><Sparkles /></div>
        <DialogTitle className="text-2xl text-portal-text">Your garage, now easier to manage</DialogTitle>
        <DialogDescription className="text-base leading-6 text-portal-muted">Choose a vehicle, follow service progress, review documents, and message your shop from one secure dashboard.</DialogDescription>
      </DialogHeader>
      <button className="portal-primary-button mt-4 w-full" onClick={onClose}>Explore my dashboard</button>
    </DialogContent>
  </Dialog>;
}