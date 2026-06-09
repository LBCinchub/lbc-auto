import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export function useEmailSend() {
  const [sending, setSending] = useState(null);
  const { toast } = useToast();

  /**
   * @param {string} id           - Record ID used to track loading state
   * @param {string} type         - "estimate" | "invoice" | "appointment" | "repair_order"
   * @param {string|null} to      - Customer email (if known from cache)
   * @param {string} customerId   - Customer entity ID (used to fetch email if not cached)
   * @param {string} customerName - Customer name
   * @param {object} record       - Full record object
   */
  const sendEmail = async (id, type, to, customerId, customerName, record) => {
    setSending(id);
    try {
      let email = to?.trim() || null;

      // Fall back to fetching the customer directly if email not in cache
      if (!email && customerId) {
        const customer = await base44.entities.Customer.get(customerId);
        email = customer?.email?.trim() || null;
      }

      if (!email) {
        toast({
          title: "⚠️ No email on file",
          description: "Add an email address to this customer's profile and try again.",
          variant: "destructive",
        });
        return;
      }

      await base44.functions.invoke("sendLBCAutoEmail", {
        type,
        to: email,
        customer_name: customerName,
        record,
      });

      toast({ title: `✅ Email sent to ${email}` });
    } catch (err) {
      const detail = err?.response?.data?.error || err?.message || "Unknown error";
      toast({
        title: "Failed to send email",
        description: detail,
        variant: "destructive",
      });
    } finally {
      setSending(null);
    }
  };

  return { sending, sendEmail };
}