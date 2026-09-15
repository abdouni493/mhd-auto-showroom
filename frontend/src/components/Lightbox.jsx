import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

// Full-screen image viewer. Shows the picture at its REAL aspect ratio (never
// cropped), lets the user click to zoom in for a closer look, drag to pan while
// zoomed, and step through several photos. Rendered through a portal on <body>
// so it always sits above modals. Closes on the backdrop, the ✕, or Escape.
export default function Lightbox({ images = [], index = 0, onClose }) {
  const count = images.length;
  const [i, setI] = useState(index);
  const [zoomed, setZoomed] = useState(false);
  const dragRef = useRef(null);

  useEffect(() => setI(index), [index]);

  const go = useCallback(
    (delta) => {
      setZoomed(false);
      setI((prev) => (prev + delta + count) % count);
    },
    [count]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // lock background scroll
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [go, onClose]);

  if (!count) return null;
  const multi = count > 1;

  const node = (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/92 backdrop-blur-sm no-print select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 z-20 bg-white/10 hover:bg-white/20 rounded-full p-2 text-white transition"
        aria-label="Fermer"
      >
        <X size={22} />
      </button>

      {/* Counter + zoom hint */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 text-white/80 text-xs font-bold">
        {multi && <span className="bg-white/10 rounded-full px-3 py-1.5">{i + 1} / {count}</span>}
        <span className="bg-white/10 rounded-full px-3 py-1.5 inline-flex items-center gap-1.5">
          {zoomed ? <ZoomOut size={13} /> : <ZoomIn size={13} />}
          {zoomed ? "Réduire" : "Cliquer pour agrandir"}
        </span>
      </div>

      {/* Prev / next */}
      {multi && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="absolute left-3 sm:left-6 z-20 bg-white/10 hover:bg-white/20 rounded-full p-2.5 text-white transition"
            aria-label="Précédent"
          >
            <ChevronLeft size={26} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); go(1); }}
            className="absolute right-3 sm:right-6 z-20 bg-white/10 hover:bg-white/20 rounded-full p-2.5 text-white transition"
            aria-label="Suivant"
          >
            <ChevronRight size={26} />
          </button>
        </>
      )}

      {/* Drag boundary = the whole viewport, so panning keeps the image on-screen */}
      <div ref={dragRef} className="absolute inset-0 overflow-hidden flex items-center justify-center">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.img
            key={i}
            src={images[i]}
            alt=""
            className={`max-w-[92vw] max-h-[88vh] object-contain rounded-lg shadow-2xl ${zoomed ? "cursor-zoom-out" : "cursor-zoom-in"}`}
            drag={zoomed}
            dragConstraints={dragRef}
            dragElastic={0.15}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: zoomed ? 2.2 : 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            onClick={(e) => { e.stopPropagation(); setZoomed((z) => !z); }}
            draggable={false}
          />
        </AnimatePresence>
      </div>
    </motion.div>
  );

  return createPortal(node, document.body);
}
