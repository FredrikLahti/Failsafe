import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Failsafe — Even if you fail, your loved ones win.",
    short_name: "Failsafe",
    description:
      "Build a habit. Choose a consequence: an experience you pay for on behalf of someone you care about if you fail.",
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
