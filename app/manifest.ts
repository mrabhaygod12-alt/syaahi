import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Syaahi — Handwritten Exam Notes",
    short_name: "Syaahi",
    description: "AI-generated handwritten-style exam revision notes as PDF.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fcf9f4",
    theme_color: "#214b40",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
