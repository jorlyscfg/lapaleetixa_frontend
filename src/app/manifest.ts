import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Plataforma SaaS",
    short_name: "SaaS",
    description: "Plataforma SaaS para operaciones multi-tenant.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
