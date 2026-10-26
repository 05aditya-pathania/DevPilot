/**
 * DevPilot — Pointer Effects Tracker
 * Provides ambient cursor coordinates (--mx, --my) for background lighting
 * and card-relative coordinates (--x, --y) for spotlight overlays.
 *
 * Performance & Accessibility:
 * - Uses one single passive pointermove listener throttled with requestAnimationFrame.
 * - Completely inactive on touch devices (hover: none) and prefers-reduced-motion.
 */

export function initPointerFx() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const isTouch = window.matchMedia("(hover: none)").matches;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (isTouch || prefersReducedMotion) {
    return () => {};
  }

  let rafId = null;
  let clientX = -999;
  let clientY = -999;
  let currentCard = null;

  const root = document.documentElement;

  const onPointerMove = (e) => {
    clientX = e.clientX;
    clientY = e.clientY;

    const target = e.target;
    currentCard = target ? target.closest(".stat-card, .project-card, .action-card") : null;

    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        root.style.setProperty("--mx", `${clientX}px`);
        root.style.setProperty("--my", `${clientY}px`);
        root.style.setProperty("--pointer-active", "1");

        if (currentCard) {
          const rect = currentCard.getBoundingClientRect();
          const cardX = clientX - rect.left;
          const cardY = clientY - rect.top;
          currentCard.style.setProperty("--x", `${cardX}px`);
          currentCard.style.setProperty("--y", `${cardY}px`);
        }
      });
    }
  };

  const onPointerLeave = () => {
    root.style.setProperty("--pointer-active", "0");
  };

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerleave", onPointerLeave, { passive: true });

  return () => {
    window.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerleave", onPointerLeave);
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
  };
}
