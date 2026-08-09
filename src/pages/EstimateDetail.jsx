import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import OriginalEstimateEditor from "@/components/estimates/OriginalEstimateEditor";

export default function EstimateDetail() {
  const { estimateId } = useParams();
  const navigate = useNavigate();
  return (
    <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
      <OriginalEstimateEditor estimateId={estimateId} onClose={() => navigate(-1)} />
    </div>
  );
}