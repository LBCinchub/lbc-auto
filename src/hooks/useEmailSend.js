import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export function useEmailSend() {
  const [sending, setSending] = useState(null);
  const { toast } = useToast();

  /**
   * @param {string} id        - Record ID (estimate/invoice/appointment/order) used to track loading state
   * @param {string} customerId - Customer entity ID to look up email directly if not provided
   * @param {string|null} emailFromCache - Email already resolved from local state (pass null to fetch)
   * @param {string} subject
   * @param {string} body
   */
  const sendEmail = async (id, customerId, emailFromCache, subject, body) => {
    setSending(id);
    try {
      let to = emailFromCache?.trim() || null;

      // If email wasn't in local cache, fetch directly from the Customer entity
      if (!to && customerId) {
        const customer = await base44.entities.Customer.get(customerId);
        to = customer?.email?.trim() || null;
      }

      if (!to) {
        toast({
          title: "No email on file for this customer",
          description: "Add an email address to the customer's profile and try again.",
          variant: "destructive",
        });
        return;
      }

      await base44.integrations.Core.SendEmail({ to, subject, body });
      toast({ title: "Email sent", description: `Sent to ${to}` });
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