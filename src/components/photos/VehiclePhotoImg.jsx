import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Private photos (photo_uri) render through short-lived signed links, cached so the
// thumbnail, lightbox and print report share one link. Older records keep photo_url.
const TTL_SECONDS = 3600;
const signedCache = new Map(); // file_uri -> { promise, expiresAt }

function signedUrlFor(uri) {
  const hit = signedCache.get(uri);
  if (hit && hit.expiresAt > Date.now()) return hit.promise;
  const promise = base44.integrations.Core
    .CreateFileSignedUrl({ file_uri: uri, expires_in: TTL_SECONDS })
    .then((res) => res.signed_url);
  promise.catch(() => signedCache.delete(uri));
  signedCache.set(uri, { promise, expiresAt: Date.now() + (TTL_SECONDS - 300) * 1000 });
  return promise;
}

export const hasPhoto = (photo) => Boolean(photo?.photo_uri || photo?.photo_url || photo?.photo_base64);

function usePhotoSrc(photo) {
  const uri = photo?.photo_uri || null;
  const [signed, setSigned] = useState({ uri: null, url: null });

  useEffect(() => {
    if (!uri) return undefined;
    let active = true;
    signedUrlFor(uri).then((url) => { if (active) setSigned({ uri, url }); });
    return () => { active = false; };
  }, [uri]);

  if (uri) return signed.uri === uri ? signed.url : null;
  return photo?.photo_url || photo?.photo_base64 || null;
}

export default function VehiclePhotoImg({ photo, className = "", style }) {
  const src = usePhotoSrc(photo);
  if (!src) return <div aria-hidden="true" className={`animate-pulse bg-gray-800 ${className}`} style={style} />;
  return <img src={src} alt={photo.label || "Vehicle photo"} className={className} style={style} />;
}