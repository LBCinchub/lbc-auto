import React from "react";
import { Loader2, MessageSquareText, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TextPartsStatus from "@/components/document-delivery/TextPartsStatus";
import PickupRecipientCard from "./PickupRecipientCard";
import usePickupText from "./usePickupText";

// Explicit staff action: edit the suggested pickup message locally, then Send. Never automatic.
export default function PickupTextDialog({ orderId, onClose, onSent }) {
  const { info, body, setBody, group, error, sending, state, send, retry } = usePickupText(orderId, onSent);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !sending) onClose(); }}>
      <DialogContent className="lbc-max-92 flex max-w-lg flex-col overflow-y-auto border-gray-800 bg-gray-950 text-white" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-emerald-400" /> Text Ready For Pickup</DialogTitle>
          <DialogDescription className="text-gray-400">A Plain Text Message To This Repair Order's Customer. No Links, PDFs Or Prices. Nothing Is Sent Until You Press Send.</DialogDescription>
        </DialogHeader>
        {!info && !error && <p className="flex items-center gap-2 py-6 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Checking The Repair Order And Texting Setup…</p>}
        {info && (
          <div className="space-y-3 text-sm">
            <PickupRecipientCard info={info} />
            {info.blocker && <p role="alert" className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-amber-200">{info.blocker}</p>}
            {!info.sender_ready && <p role="alert" className="text-amber-300">{info.sender_problem}</p>}
            {!info.blocker && (
              <div>
                <label htmlFor="pickup-body" className="mb-1 block text-xs text-gray-400">Message</label>
                <Textarea id="pickup-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} disabled={sending} data-no-capitalize data-lbc-small
                  className="border-gray-700 bg-gray-900 text-sm text-gray-100" />
                <p className="mt-1 text-xs text-gray-500">Always Added: "{info.footer}"</p>
                <p className={`text-xs ${state.tooLong ? "text-rose-400" : "text-gray-500"}`}>
                  {state.seg.chars} Characters · {state.seg.unicode ? "Unicode" : "Standard Characters"} · About {state.seg.segments} SMS Segment{state.seg.segments === 1 ? "" : "s"} (Max {info.max_segments})
                </p>
              </div>
            )}
            {group && <TextPartsStatus group={group} title={state.sentHere ? "This Send" : "Last Pickup Text"} />}
          </div>
        )}
        {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="outline" className="min-h-[44px] border-gray-700 bg-transparent sm:min-h-9" onClick={onClose} disabled={sending}>Close</Button>
          {state.canRetry && (
            <Button variant="outline" onClick={retry} className="min-h-[44px] border-amber-600 bg-transparent text-amber-300 sm:min-h-9"><RotateCcw className="h-4 w-4" /> Retry Send</Button>
          )}
          {info && !info.blocker && (!state.sentHere || state.freshKey) && (
            <Button onClick={send} disabled={!state.canSend} className="min-h-[44px] bg-emerald-600 hover:bg-emerald-500 sm:min-h-9">
              {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : "Send Text"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}