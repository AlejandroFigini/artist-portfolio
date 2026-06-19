import type { NextConfig } from "next";

// El backend Express (server.js del proyecto legacy) corre aparte.
// /api/* se proxea para mantener el mismo origen que el sitio legacy
// (sin CORS y sin URLs hardcodeadas en el cliente).
const API_URL = process.env.API_URL || "http://localhost:3001";

const nextConfig: NextConfig = {
  // Oculta el indicador flotante de Next.js Dev Tools (la "N" en dev).
  devIndicators: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
