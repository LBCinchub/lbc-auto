import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";

export default function AppointmentConfirmModal({ appointment, onClose }) {
  if (!appointment) return null;

  const phoneDigits = (appointment.customer_phone || "").replace(/\D/g, "");
  const msg = `Hi ${appointment.customer_name}, your appointment at Haj Rims & Tires is confirmed for ${appointment.date} - ${appointment.service_type}. See you then! 📞 613-672-2727`;
  const waUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(msg)}`;

  return (
    <Dialog open={!!appointment} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Appointment Confirmed ✓</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-center text-gray-300 text-sm">
            Send confirmation to <span className="text-sky-400 font-semibold">{appointment.customer_name}</span>?
          </p>
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <p className="text-xs text-gray-400 leading-relaxed italic">{msg}</p>
          </div>
          {phoneDigits ? (
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Button className="w-full bg-green-600 hover:bg-green-700 gap-2">
                <MessageCircle className="w-4 h-4" /> Send WhatsApp
              </Button>
            </a>
          ) : (
            <p className="text-center text-xs text-amber-400">No phone number on file — cannot send WhatsApp.</p>
          )}
          <Button variant="outline" onClick={onClose} className="w-full border-gray-700 text-gray-400 hover:text-white gap-2">
            <X className="w-4 h-4" /> Skip
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}