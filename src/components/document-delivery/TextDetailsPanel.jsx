import React from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import TextMessagePreview from "./TextMessagePreview";
import TextPartsStatus from "./TextPartsStatus";
import ProUpgradeNotice from "./ProUpgradeNotice";
import useDocumentText from "./useDocumentText";
import { textSendState } from "./deliveryUi";

// "Send As Text": readable details of the saved document, previewed exactly, sent only on click.
export default function TextDetailsPanel({ documentType, documentId, onBack, onClose, onBusy }) {
  const { info, group, error, sending, send, resume, locked } = useDocumentText(documentType, documentId);
  const st = textSendState(info, group, sending);
  React.useEffect(() => onBusy(sending), [sending]);
  // Pro lapsed or unconfirmed (also between preview and send): no send control, upgrade path only.
  if (locked) return (
    <div className="space-y-3 text-sm">
      {group && <TextPartsStatus group={group} title={st.sentHere ? "This send" : "Last text send"} />}
      <ProUpgradeNotice lock={locked} onClose={onClose} />
      <div className="flex justify-end pt-2"><Button variant="outline" className="border-gray-700 bg-transparent" onClick={onClose}>Close</Button></div>
    </div>
  );
  return (
    <div className="space-y-3 text-sm">
      {!info && !error && <p className="flex items-center gap-2 py-6 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Building the text from the saved {documentType}…</p>}
      {info && <p className="text-gray-300">From <strong className="text-white">{info.shop_name || "your shop (name missing)"}</strong> to <strong className="text-white">{info.customer_name}</strong> at <strong className="text-white">{info.to}</strong></p>}
      {info?.blocker && (
        <p role="alert" className="text-amber-300">{info.blocker} Nothing was sent.
          {info.blocker_code === "shop_identity_missing" && <> <Link to="/Settings" className="underline" onClick={onClose}>Open Settings</Link></>}
        </p>
      )}
      {info?.parts && !st.sentHere && <TextMessagePreview info={info} />}
      {info && !info.sender_ready && <p role="alert" className="text-amber-300">{info.sender_problem} The text can't be sent until this is fixed.</p>}
      {group && <TextPartsStatus group={group} title={st.sentHere ? "This send" : "Last text send"} />}
      {error && <p role="alert" className="text-rose-400">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button variant="outline" className="border-gray-700 bg-transparent" onClick={onBack} disabled={sending}>Back to PDF</Button>
        <Button variant="outline" className="border-gray-700 bg-transparent" onClick={onClose} disabled={sending}>Close</Button>
        {st.canResume && <Button onClick={resume} className="bg-amber-600 hover:bg-amber-500">Send Remaining Texts</Button>}
        {info && !st.sentHere && (
          <Button onClick={send} disabled={!st.canSend} className="bg-emerald-600 hover:bg-emerald-500">
            {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : info.part_count > 1 ? `Send ${info.part_count} Texts` : "Send Text"}
          </Button>
        )}
      </div>
    </div>
  );
}