import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle } from "lucide-react";

export default function QuickStockUpdate({ open, part, onClose, onUpdate }) {
  const [quantity, setQuantity] = useState(part?.quantity || 0);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const handleUpdate = async () => {
    setUpdating(true);
    setError("");

    try {
      await onUpdate(part.id, quantity);
      setQuantity(0);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update stock");
    } finally {
      setUpdating(false);
    }
  };

  const handleQuantityChange = (e) => {
    const val = parseInt(e.target.value) || 0;
    setQuantity(Math.max(0, val));
  };

  const incrementQuantity = () => setQuantity(q => q + 1);
  const decrementQuantity = () => setQuantity(q => Math.max(0, q - 1));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Update Stock</DialogTitle>
        </DialogHeader>

        {part && (
          <div className="space-y-4">
            <div className="bg-gray-800/30 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Part</p>
              <p className="font-semibold text-white">{part.name}</p>
              <p className="text-xs text-gray-400 mt-2">{part.part_number}</p>
            </div>

            <div className="bg-gray-800/30 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-2">Current Stock: {part.quantity}</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={decrementQuantity}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  −
                </Button>
                <Input
                  type="number"
                  value={quantity}
                  onChange={handleQuantityChange}
                  className="flex-1 bg-gray-800 border-gray-700 text-white text-center"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={incrementQuantity}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  +
                </Button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={updating || quantity === part.quantity}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {updating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  `Set to ${quantity}`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}