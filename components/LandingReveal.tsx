"use client";
import { useEffect } from "react";
export default function LandingReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const nodes = document.querySelectorAll(
      ".curriculum-tag,.pillar-card,.retention-card,.feature-grid article",
    );
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    nodes.forEach((node, i) => {
      (node as HTMLElement).style.setProperty(
        "--reveal-delay",
        `${(i % 4) * 65}ms`,
      );
      node.classList.add("scroll-reveal");
      observer.observe(node);
    });
    return () => {
      observer.disconnect();
      nodes.forEach((n) => n.classList.remove("scroll-reveal"));
    };
  }, []);
  return null;
}
