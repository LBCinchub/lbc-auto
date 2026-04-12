import React, { useRef, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Camera, X, ScanLine, Loader2, Upload } from "lucide-react";

export default function VinScanner({ onVinDetected, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [step, setStep] = useState("preview"); // preview | processing | done | error
  const [error, setError] = useState("");

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Camera is not supported on this device. Please use the Upload option instead.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      const errMsg = err?.name === "NotAllowedError" 
        ? "Camera permission denied. Please allow camera access in your browser settings and try again."
        : err?.name === "NotFoundError"
        ? "No camera device found. Please use the Upload option instead."
        : "Camera access failed. Please try using the Upload option instead.";
      setError(errMsg);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  const processBlob = async (blob) => {
    stopCamera();
    setStep("processing");
    try {
      const file = blob instanceof File ? blob : new File([blob], "vin_scan.jpg", { type: "image/jpeg" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Look at this image carefully. Find the VIN (Vehicle Identification Number) — it's typically a 17-character alphanumeric code found on the dashboard near the windshield, door jamb sticker, or engine bay. Extract the exact VIN characters. Then decode the VIN to get the vehicle's make, model, year, color, and engine type. Return all data.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            vin: { type: "string" },
            make: { type: "string" },
            model: { type: "string" },
            year: { type: "number" },
            color: { type: "string" },
            engine_type: { type: "string" }
          }
        }
      });
      if (result?.vin) {
        onVinDetected(result);
        onClose();
      } else {
        setError("Could not detect a VIN in the image. Please try again with better lighting or a clearer angle.");
        setStep("error");
      }
    } catch (err) {
      setError("Something went wrong: " + (err?.message || "Please try again."));
      setStep("error");
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => processBlob(blob), "image/jpeg", 0.92);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processBlob(file);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/70 absolute top-0 left-0 right-0 z-10">
        <span className="text-white font-semibold text-sm">Scan VIN</span>
        <button onClick={onClose} className="text-white hover:text-gray-300 p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Video */}
      {step === "preview" && (
        <>
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          {/* Overlay guide */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="border-2 border-sky-400 rounded-lg w-[80%] max-w-md h-24 flex items-center justify-center relative">
              <ScanLine className="w-8 h-8 text-sky-400 animate-pulse" />
              <div className="absolute -top-1 left-0 w-6 h-6 border-t-4 border-l-4 border-sky-400 rounded-tl" />
              <div className="absolute -top-1 right-0 w-6 h-6 border-t-4 border-r-4 border-sky-400 rounded-tr" />
              <div className="absolute -bottom-1 left-0 w-6 h-6 border-b-4 border-l-4 border-sky-400 rounded-bl" />
              <div className="absolute -bottom-1 right-0 w-6 h-6 border-b-4 border-r-4 border-sky-400 rounded-br" />
            </div>
            <p className="text-white text-sm mt-4 bg-black/60 px-3 py-1.5 rounded-full">
              Point camera at VIN sticker on door jamb or dashboard
            </p>
          </div>
          {/* Capture / Upload buttons */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-8">
            <label className="flex flex-col items-center gap-1 cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-gray-800/80 border-2 border-gray-500 flex items-center justify-center hover:border-sky-400 transition-colors">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <span className="text-white text-xs">Upload</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
            <button onClick={capture}
              className="w-16 h-16 rounded-full bg-white border-4 border-sky-400 flex items-center justify-center shadow-lg hover:scale-105 transition-transform active:scale-95">
              <Camera className="w-7 h-7 text-gray-800" />
            </button>
          </div>
        </>
      )}

      {step === "processing" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white">
          <Loader2 className="w-12 h-12 animate-spin text-sky-400" />
          <p className="text-lg font-medium">Scanning VIN...</p>
          <p className="text-gray-400 text-sm">AI is reading the VIN and looking up vehicle details</p>
        </div>
      )}

      {(step === "error") && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-rose-500/20 flex items-center justify-center">
            <X className="w-7 h-7 text-rose-400" />
          </div>
          <p className="text-lg font-medium">Scan Failed</p>
          <p className="text-gray-400 text-sm">{error}</p>
          <div className="flex gap-3 mt-2">
            <Button onClick={() => { setError(""); setStep("preview"); startCamera(); }} className="bg-sky-500 hover:bg-sky-600">
              Try Again
            </Button>
            <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300">Cancel</Button>
          </div>
        </div>
      )}

      {error && step === "preview" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white px-6 text-center">
          <p className="text-rose-400">{error}</p>
          <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300">Close</Button>
        </div>
      )}

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}