import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The photo scanner was retired; old links go to the DAR form.
    return [{ source: "/dar/scan", destination: "/dar", permanent: false }];
  },
  async headers() {
    return [
      {
        // Always check for a new service worker so updates reach phones quickly.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
