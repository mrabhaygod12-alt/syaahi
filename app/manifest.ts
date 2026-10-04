import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Syaahi: Learn, Create and Publish",
    short_name: "Syaahi",
    description:
      "Learning and writing workspaces for notes, presentations and reviewed articles.",
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
