import { useState, useEffect, useCallback } from "react";
import { supabase, getPublicUrl, guessContentType, requireSession, BUCKETS } from "../lib/supabase.js";
import { compressForBucket, extForType } from "../lib/imageCompression.js";

// Generic data hook. Takes an async fetch function (was a URL string before).
export function useFetch(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (e) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch, setData };
}

// Upload one or more files to a Supabase Storage bucket; return public URLs.
// `bucket` lets callers route logos / client photos / car images to the right
// bucket (each enforces its own allowed mime types). Defaults to car-images.
export async function uploadImages(files, bucket = BUCKETS.carImages) {
  await requireSession();
  const urls = [];
  for (const original of files) {
    // Optimise in the browser first (10 MB → ~1 MB), then upload the small one.
    const file = await compressForBucket(original, bucket);
    const contentType = file.type || guessContentType(file);
    const fallbackExt = (original.name.split(".").pop() || "bin").toLowerCase();
    const ext = extForType(contentType, fallbackExt);
    const path = `uploads/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true, contentType });
    if (error) throw error;
    urls.push(getPublicUrl(bucket, data.path));
  }
  return urls;
}
