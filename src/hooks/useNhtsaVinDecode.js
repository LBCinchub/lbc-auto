import { useState, useRef, useEffect } from "react";
import { createVinDecoder } from "@/lib/vin";

/**
 * Calls the free NHTSA VIN decoder API directly from the frontend.
 * Returns { decoding, vinError, decodeVin, setVinError }
 *
 * decodeVin(vin) resolves with { make, model, year, engine_type, trim } on success,
 * or null on failure / timeout / when superseded by a newer request.
 * Never touches caller form values — callers merge only on success.
 */
export function useNhtsaVinDecode() {
  const [decoding, setDecoding] = useState(false);
  const [vinError, setVinError] = useState("");
  const decoderRef = useRef(null);
  if (!decoderRef.current) decoderRef.current = createVinDecoder();
  const pendingRef = useRef(0);

  useEffect(() => () => decoderRef.current.cancel(), []);

  const decodeVin = async (vin) => {
    setVinError("");
    pendingRef.current++;
    setDecoding(true);
    const result = await decoderRef.current.decode(vin);
    pendingRef.current--;
    if (pendingRef.current === 0) setDecoding(false);
    if (result.status === "stale") return null;
    if (result.status !== "ok") { setVinError(result.error); return null; }
    return result.data;
  };

  return { decoding, vinError, decodeVin, setVinError };
}