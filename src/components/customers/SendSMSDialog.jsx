import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Loader2 } from "lucide-react";

const TEMPLATES = [
  {
    label: "Vehicle Ready",
    text: (name) => `Hi ${name}, your vehicle is ready for pickup at our shop. Please give us a call if you have any questions!`,
  },
  {
    label: "Update – In Progress",
    text: (name) => `Hi ${name}, just a quick update — your vehicle is currently being worked on. We'll let you know as soon as it's ready!`,
  },
  {
    label: "Waiting for Parts",
    text: (name) => `Hi ${name}, we're waiting on parts for your vehicle. We'll reach out as soon as they arrive and we can get started.`,
  },
  {
    label: "Invoice Due",
    text: (name) => `Hi ${name}, you have an outstanding invoice with us. Please contact us at your earliest convenience to arrange payment. Thank you!`,
  },
  {
    label: "Appointment Reminder",
    text: (name) => `Hi ${name}, this is a reminder about your upcoming appointment with us. Please call if you need to reschedule. See you soon!`,
  },
];

export default function SendSMSDialog({ open, onClose, customer }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleTemplate = (tpl) => {
    setMessage(tpl.text(customer?.full_name?.split(" ")[0] || customer?.full_name || "there"));
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    setError("");
    try {
      await base44.functions.invoke("sendSMS", { phone: customer.phone, message });
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setMessage("");
        onClose();
      }, 1500);
    } catch (err) {
      const detail = err?.response?.data?.details?.message || err?.response?.data?.error || err.message;
      setError(`Failed: ${detail}`);
    } finally {
      setSending(false);
    }
  };

  const handleOpenChange = (val) => {
    if (!val) { setMessage(""); setError(""); setSent(false); onClose(); }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-sky-400" />
            Send Message to {customer?.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-xs text-gray-500">To: {customer?.phone}</p>

          {/* Templates */}
          <div>
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Quick Templates</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map(tpl => (
                <button
                  key={tpl.label}
                  onClick={() => handleTemplate(tpl)}
                  className="text-xs px-2.5 py-1 rounded-full border border-gray-700 text-gray-300 hover:border-sky-500 hover:text-sky-400 transition-colors"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type your message here..."
            className="bg-gray-800 border-gray-700 text-white min-h-[120px] resize-none"
          />
          <p className="text-xs text-gray-600 text-right">{message.length} characters</p>

          {error && <p className="text-rose-400 text-xs">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="text-gray-400" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !message.trim() || sent}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              {sent ? "Sent!" : sending ? "Sending..." : "Send SMS"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}