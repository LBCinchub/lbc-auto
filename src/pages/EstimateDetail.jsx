import React from "react";
import { useParams } from "react-router-dom";
import OriginalEstimateEditor from "@/components/estimates/OriginalEstimateEditor";
import { useSmartBack } from "@/components/shared/useSmartBack";

export default function EstimateDetail() {
  const { estimateId } = useParams();
  const goBack = useSmartBack("/Estimates");
  return (
    <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
      <OriginalEstimateEditor estimateId={estimateId} onClose={goBack} />
    </div>
  );
}