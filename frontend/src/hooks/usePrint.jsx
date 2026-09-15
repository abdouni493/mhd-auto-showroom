import { createRoot } from "react-dom/client";

const PX_PER_MM = 96 / 25.4; // CSS pixels per millimetre at 96dpi
// A4 portrait content box = 297mm − 10mm top − 10mm bottom margin (see @page).
const PAGE_CONTENT_MM = 277;

// Render a React node into a transient print container and trigger window.print()
export function printNode(node) {
  const container = document.createElement("div");
  // Render off-screen but VISIBLE first so the sheet can be measured — the
  // `.print-area` class (which hides the node on screen) is only added just
  // before printing, once measuring/scaling is done.
  container.style.cssText = "position:fixed;left:-10000px;top:0;width:190mm;background:#fff;";
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(node);

  // give the browser a moment to render images/layout
  setTimeout(() => {
    const sheet = container.firstElementChild;
    // Single-page documents are flagged by the fixed sheet height that
    // sheetStyle(lang, true) sets. If a dense one (a form with a full
    // inspection, many documents, a long client block…) ends up taller than a
    // single sheet, scale it down so it always prints on exactly ONE page
    // instead of spilling a few lines onto a second sheet. Multi-page table
    // reports carry no such flag and keep paginating normally.
    if (sheet && sheet.style.minHeight) {
      const pagePx = PAGE_CONTENT_MM * PX_PER_MM;
      const height = sheet.getBoundingClientRect().height;
      if (height > pagePx) {
        const scale = pagePx / height;
        sheet.style.transformOrigin = "top center";
        sheet.style.transform = `scale(${scale})`;
        // Cap the flow height so the browser paginates it as a single page.
        container.style.height = pagePx + "px";
        container.style.overflow = "hidden";
      }
    }

    // Switch to the real print container. `printing` drops the app from the flow
    // so the document paginates normally (multi-page reports).
    container.className = "print-area";
    container.style.position = "";
    container.style.left = "";
    container.style.top = "";
    container.style.width = "";
    document.body.classList.add("printing");

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove("printing");
        root.unmount();
        document.body.removeChild(container);
      }, 600);
    }, 80);
  }, 350);
}
