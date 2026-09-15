import { useState, useRef } from "react";
import { UploadCloud, X, ImageIcon, Maximize2 } from "lucide-react";
import { uploadImages } from "../hooks/useApi.js";
import Lightbox from "./Lightbox.jsx";

// Multiple image upload with previews. value = array of urls.
// Each picked file is optimised in the browser (see lib/imageCompression.js)
// before it reaches Supabase, so a heavy phone photo lands as a light WebP.
export function MultiImageUpload({ value = [], onChange, bucket }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null); // lightbox index
  const inputRef = useRef();

  const handleFiles = async (files) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await uploadImages(Array.from(files), bucket);
      onChange([...value, ...urls]);
    } catch (e) {
      alert(e?.message || "Erreur lors du téléchargement de l'image");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className="border-2 border-dashed border-red-600/40 rounded-xl p-6 text-center cursor-pointer hover:border-red-600 hover:bg-red-600/5 transition"
      >
        <UploadCloud className="mx-auto text-red-500 mb-2" size={32} />
        <p className="text-sm text-text-muted">
          {uploading ? "Optimisation et téléchargement..." : "Glissez des images ici ou cliquez pour parcourir"}
        </p>
        <p className="text-[0.7rem] text-text-muted/70 mt-1">Les images sont automatiquement optimisées avant l'envoi.</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-3">
          {value.map((url, i) => (
            <div
              key={i}
              onClick={() => setPreview(i)}
              className="relative group aspect-[4/3] rounded-lg overflow-hidden border border-red-600/30 bg-gradient-to-br from-red-950/40 to-black cursor-zoom-in"
            >
              <img src={url} alt="" className="w-full h-full object-contain" />
              <div className="absolute bottom-1 left-1 bg-black/55 rounded p-1 text-white/90 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <Maximize2 size={12} />
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(value.filter((_, idx) => idx !== i)); }}
                className="absolute top-1 right-1 bg-black/70 rounded-full p-1 text-white opacity-0 group-hover:opacity-100 transition"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {preview != null && <Lightbox images={value} index={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

// Single avatar/photo upload (square). `fit` controls the preview: "cover"
// (cropped avatar, default) or "contain" (full image, e.g. a logo).
export function SingleImageUpload({ value, onChange, label = "Photo", size = 96, bucket, fit = "cover" }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const [url] = await uploadImages([file], bucket);
      onChange(url);
    } catch (e) {
      alert(e?.message || "Erreur lors du téléchargement");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div
        onClick={() => inputRef.current?.click()}
        style={{ width: size, height: size }}
        className="rounded-xl border-2 border-dashed border-red-600/40 flex items-center justify-center cursor-pointer hover:border-red-600 overflow-hidden bg-red-600/5 shrink-0"
      >
        {value ? (
          <img src={value} alt="" className={`w-full h-full ${fit === "contain" ? "object-contain p-1.5" : "object-cover"}`} />
        ) : (
          <ImageIcon className="text-red-500" size={28} />
        )}
      </div>
      <div>
        <p className="label-caps">{label}</p>
        <button type="button" className="btn-ghost text-xs py-1.5 px-3" onClick={() => inputRef.current?.click()}>
          {uploading ? "..." : value ? "Changer" : "Choisir"}
        </button>
        {value && (
          <button type="button" className="text-xs text-rose-400 ml-2" onClick={() => onChange(null)}>
            Retirer
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
    </div>
  );
}
