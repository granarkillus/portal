import type { MetadataRoute } from "next";

// Lets officers "Add to Home Screen" and open the forms like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Allied Officer Forms",
    short_name: "Allied Forms",
    description: "Call off, submit a DAR, request time off, or respond to a write-up.",
    start_url: "/forms",
    scope: "/",
    display: "standalone",
    background_color: "#f2f5fa",
    theme_color: "#1a4480",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
