import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Repair order change log (shared by the Repair Orders list and the customer profile).
export default function RepairOrderHistoryDialog({ order, onClose }) {
  if (!order) return null;
  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>Repair Order History - {order.order_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {order.history?.map((entry, idx) => (
            <div key={idx} className="border-l-2 border-sky-500/50 pl-4 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-sky-400">{entry.action}</span>
                <span className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</span>
              </div>
              <div className="text-xs text-gray-400 mb-1">By: {entry.user}</div>
              {entry.changes && Object.keys(entry.changes).length > 0 && (
                <div className="text-sm text-gray-300 space-y-1">
                  {Object.entries(entry.changes).map(([key, val]) => (
                    <div key={key}>
                      <span className="text-gray-500">{key}:</span>{' '}
                      <span className="text-rose-400">{val.from || 'none'}</span> →{' '}
                      <span className="text-emerald-400">{val.to}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}