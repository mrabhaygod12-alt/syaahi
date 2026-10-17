"use client";
import { useEffect } from "react";
export default function LandingMotion() {
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const nodes = document.querySelectorAll<HTMLElement>(
      ".landing-page [data-reveal]",
    );
    // Content is always visible; motion is a progressive enhancement.
    const resetMotion = () => {
      if (reduced.matches) nodes.forEach((n) => n.classList.add("is-visible"));
    };
    resetMotion();
    reduced.addEventListener("change", resetMotion);
    document.documentElement.classList.add("landing-motion-ready");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.05 },
    );
    nodes.forEach((n) => observer.observe(n));
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const progress = Math.min(
          1,
          scrollY /
            Math.max(1, document.documentElement.scrollHeight - innerHeight),
        );
        document.documentElement.style.setProperty(
          "--landing-progress",
          String(progress),
        );
        document.documentElement.style.setProperty(
          "--hero-scroll",
          String(Math.min(scrollY / 800, 1)),
        );
      });
    };
    addEventListener("scroll", update, { passive: true });
    const depthNodes = document.querySelectorAll<HTMLElement>(
      ".growth-editorial [data-depth]",
    );
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
    const cleanups = Array.from(depthNodes, (node) => {
      let pending = 0;
      const reset = () => {
        cancelAnimationFrame(pending);
        node.style.removeProperty("--depth-x");
        node.style.removeProperty("--depth-y");
      };
      const move = (event: PointerEvent) => {
        if (reduced.matches || !finePointer.matches) return;
        cancelAnimationFrame(pending);
        pending = requestAnimationFrame(() => {
          const rect = node.getBoundingClientRect();
          const x = Math.max(
            -1,
            Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1),
          );
          const y = Math.max(
            -1,
            Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1),
          );
          node.style.setProperty("--depth-x", `${-y * 3}deg`);
          node.style.setProperty("--depth-y", `${x * 4}deg`);
        });
      };
      node.addEventListener("pointermove", move);
      node.addEventListener("pointerleave", reset);
      reduced.addEventListener("change", reset);
      return () => {
        reset();
        node.removeEventListener("pointermove", move);
        node.removeEventListener("pointerleave", reset);
        reduced.removeEventListener("change", reset);
      };
    });
    update();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      removeEventListener("scroll", update);
      reduced.removeEventListener("change", resetMotion);
      cleanups.forEach((cleanup) => cleanup());
      document.documentElement.classList.remove("landing-motion-ready");
      document.documentElement.style.removeProperty("--hero-scroll");
      document.documentElement.style.removeProperty("--landing-progress");
    };
  }, []);
  return null;
}
