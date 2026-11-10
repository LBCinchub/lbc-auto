import React from "react";

// The exact text(s) the customer will receive, with honest segment/charge disclosure.
export default function TextMessagePreview({ info }) {
  const multi = info.part_count > 1;
  return (
    <div className="space-y-2">
      {info.parts.map((p) => (
        <div key={p.index} className="rounded-lg border border-gray-800 bg-gray-900">
          <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words p-3 font-sans text-sm text-gray-200" data-no-capitalize>{p.body}</pre>
          <p className="border-t border-gray-800 px-3 py-1.5 text-xs text-gray-500">
            {multi ? `Text ${p.index} of ${info.part_count} · ` : ""}{p.chars} characters · {p.encoding === "UCS-2" ? "Unicode (special characters)" : "Standard characters"} · about {p.segments} SMS segment{p.segments === 1 ? "" : "s"}
          </p>
        </div>
      ))}
      <p className="text-xs text-gray-500">
        {multi ? `This goes out as ${info.part_count} separate numbered texts. ` : ""}
        Long texts are split into about {info.segments_total} SMS segment{info.segments_total === 1 ? "" : "s"} in total, and Twilio bills per segment. Most phones join them into one message, but that isn't guaranteed. No links or attachments are included.
      </p>
    </div>
  );
}