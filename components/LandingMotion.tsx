"use client";
import { useEffect } from "react";
export default function LandingMotion() {
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const nodes = document.querySelectorAll<HTMLElement>(
      ".landing-page [data-reveal]",
    );
    if (reduced.matches) {
      nodes.forEach((n) => n.classList.add("is-visible"));
      return;
    }
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
      { threshold: 0.12 },
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
    update();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      removeEventListener("scroll", update);
      document.documentElement.classList.remove("landing-motion-ready");
      document.documentElement.style.removeProperty("--hero-scroll");
    };
  }, []);
  return null;
}
