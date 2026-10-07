"use client";
import { useEffect, useState } from "react";
export default function PreviewCta({ hindi = false }: { hindi?: boolean }) {
  const [variant, setVariant] = useState("A");
  useEffect(() => {
    const read = () =>
      setVariant(
        localStorage.getItem("syaahi-privacy-v1") === "analytics"
          ? sessionStorage.getItem("syaahi-hero-variant") || "A"
          : "A",
      );
    read();
    window.addEventListener("syaahi:measurement-ready", read);
    return () => window.removeEventListener("syaahi:measurement-ready", read);
  }, []);
  return (
    <a className="btn dark growth-primary" href="#try-preview">
      {hindi
        ? variant === "B"
          ? "अपना पहला पन्ना देखें →"
          : "मुफ़्त नोट प्रीव्यू देखें →"
        : variant === "B"
          ? "See my first study page →"
          : "Try a free note preview →"}
    </a>
  );
}
