import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export function useEmailSend() {
  const [sending, setSending] = useState(null); // holds the id of the record being sent
  const { toast } = useToast();

  const sendEmail = async (id, to, subject, body) => {
    if (!to) {
      toast({ title: "No email on file", description: "This customer has no email address.", variant: "destructive" });
      return;
    }
    setSending(id);
    try {
      await base44.integrations.Core.SendEmail({ to, subject, body });
      toast({ title: `Email sent to ${to}` });
    } catch (err) {
      toast({ title: "Failed to send email", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSending(null);
    }
  };

  return { sending, sendEmail };
}