import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const qrcodeRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const initScanner = async () => {
      try {
        const html5QrcodeScanner = new Html5Qrcode("qr-reader", {
          formatsToSupport: [
            Html5Qrcode.SupportedFormats.QR_CODE,
            Html5Qrcode.SupportedFormats.CODE_128,
            Html5Qrcode.SupportedFormats.CODE_39,
            Html5Qrcode.SupportedFormats.EAN_13,
            Html5Qrcode.SupportedFormats.EAN_8,
            Html5Qrcode.SupportedFormats.UPC_A,
            Html5Qrcode.SupportedFormats.UPC_E,
          ],
          disableFlip: false,
        });

        qrcodeRef.current = html5QrcodeScanner;

        await html5QrcodeScanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            onScan(decodedText);
            html5QrcodeScanner.stop();
          },
          (error) => {
            // Suppress error logs during scanning
          }
        );

        setLoading(false);
      } catch (err) {
        setError(err.message || "Failed to access camera");
        setLoading(false);
      }
    };

    initScanner();

    return () => {
      if (qrcodeRef.current) {
        qrcodeRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  const handleClose = () => {
    if (qrcodeRef.current) {
      qrcodeRef.current.stop().catch(() => {});
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Scan Barcode</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
              <p className="text-gray-400">Initializing camera...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div id="qr-reader" style={{ width: "100%" }} />

          <p className="text-center text-gray-400 text-sm mt-4">
            Point your camera at a barcode or QR code
          </p>
        </div>

        <div className="p-4 border-t border-gray-800">
          <Button
            onClick={handleClose}
            variant="outline"
            className="w-full border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}