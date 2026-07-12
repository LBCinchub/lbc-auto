import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Camera, Expand, Trash2, Link2, X, Calendar, Car } from "lucide-react";

export default function VehiclePhotosTab({ photos, repairOrders, estimates, onRefetch }) {
  const [expanded, setExpanded] = useState(null);
  const [linking, setLinking] = useState(null); // photoId being linked

  const sorted = [...photos].sort((a, b) =>
    new Date(b.taken_date || b.created_date) - new Date(a.taken_date || a.created_date)
  );

  const handleLink = async (photoId, field, value) => {
    await base44.entities.VehiclePhoto.update(photoId, { [field]: value || null });
    setLinking(null);
    onRefetch();
  };

  const handleDelete = async (photoId) => {
    if (!window.confirm("Delete this photo from the profile?")) return;
    await base44.entities.VehiclePhoto.delete(photoId);
    onRefetch();
  };

  if (sorted.length === 0) {
    return (
      <div className="text-gray-500 text-sm py-8 text-center">
        <Camera className="w-8 h-8 text-gray-600 mx-auto mb-2" />
        No photos saved yet. Photos sent to LBC Auto AI can be saved to a customer profile.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {sorted.map(photo => {
          const src = photo.photo_url || photo.photo_base64;
          if (!src) return null;
          return (
            <div key={photo.id} className="rounded-lg border border-gray-800 bg-gray-900/50 overflow-hidden group">
              {/* Thumbnail */}
              <div className="relative cursor-pointer" onClick={() => setExpanded(photo)}>
                <img src={src} alt={photo.label} className="w-full h-32 object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                  <Expand className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Info */}
              <div className="p-2.5 space-y-1">
                <div className="text-xs font-medium text-white truncate">{photo.label || "Untitled"}</div>
                <div className="flex items-center gap-1 text-[10px] text-gray-500">
                  <Calendar className="w-2.5 h-2.5" />
                  {photo.taken_date ? new Date(photo.taken_date + "T12:00:00").toLocaleDateString("en-CA") : "—"}
                </div>
                {photo.vehicle_info && (
                  <div className="flex items-center gap-1 text-[10px] text-gray-500 truncate">
                    <Car className="w-2.5 h-2.5" /> {photo.vehicle_info}
                  </div>
                )}
                {photo.ai_analysis && (
                  <div className="text-[10px] text-gray-400 line-clamp-2 mt-1">
                    AI: {photo.ai_analysis.slice(0, 80)}{photo.ai_analysis.length > 80 ? "…" : ""}
                  </div>
                )}

                {/* Linked record badge */}
                {photo.linked_repair_order_id && (
                  <div className="text-[10px] text-amber-400">→ Linked RO</div>
                )}
                {photo.linked_estimate_id && (
                  <div className="text-[10px] text-purple-400">→ Linked Estimate</div>
                )}

                {/* Actions */}
                <div className="flex gap-1 pt-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-gray-500 hover:text-sky-400 hover:bg-gray-800 p-0"
                    onClick={() => setLinking(linking === photo.id ? null : photo.id)}
                    title="Link to RO/Estimate"
                  >
                    <Link2 className="w-3 h-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 p-0"
                    onClick={() => handleDelete(photo.id)}
                    title="Delete photo"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>

                {/* Link dropdown */}
                {linking === photo.id && (
                  <div className="mt-1 space-y-1.5 bg-gray-800/80 rounded p-2 border border-gray-700">
                    <select
                      value={photo.linked_repair_order_id || ""}
                      onChange={e => handleLink(photo.id, "linked_repair_order_id", e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 text-gray-300 rounded px-2 py-1 text-[10px]"
                    >
                      <option value="">Link to Repair Order…</option>
                      {repairOrders.map(ro => (
                        <option key={ro.id} value={ro.id}>
                          {ro.order_number || ro.id.slice(0, 8)} — {(ro.description || "").slice(0, 30)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={photo.linked_estimate_id || ""}
                      onChange={e => handleLink(photo.id, "linked_estimate_id", e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 text-gray-300 rounded px-2 py-1 text-[10px]"
                    >
                      <option value="">Link to Estimate…</option>
                      {estimates.map(est => (
                        <option key={est.id} value={est.id}>
                          {est.estimate_number || est.id.slice(0, 8)} — {(est.service_reason || "").slice(0, 30)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Full-size lightbox */}
      {expanded && (
        <Dialog open={true} onOpenChange={() => setExpanded(null)}>
          <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl">
            <img
              src={expanded.photo_url || expanded.photo_base64}
              alt={expanded.label}
              className="w-full max-h-[50vh] object-contain rounded-lg"
            />
            <div className="space-y-2 mt-2">
              <div className="text-sm font-semibold text-white">{expanded.label || "Untitled"}</div>
              <div className="text-xs text-gray-400">
                {expanded.taken_date ? new Date(expanded.taken_date + "T12:00:00").toLocaleDateString("en-CA") : "—"}
                {expanded.vehicle_info ? ` · ${expanded.vehicle_info}` : ""}
              </div>
              {expanded.ai_analysis && (
                <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-300 whitespace-pre-wrap">
                  <span className="text-purple-400 font-semibold">AI Analysis:</span>
                  <br />
                  {expanded.ai_analysis}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}