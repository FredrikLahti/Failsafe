import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Failsafe: When you fail, your loved ones win.",
    short_name: "Failsafe",
    description:
      "Build a habit. Fail, and you're funding a night out for someone you love, one you're banned from attending.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#EFE6D8",
    theme_color: "#12211D",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
