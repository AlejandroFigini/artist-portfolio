import type { NextConfig } from "next";

// La API vive dentro de Next (app/api/*). No hay proxy ni backend Express aparte.
const nextConfig: NextConfig = {
  // Oculta el indicador flotante de Next.js Dev Tools (la "N" en dev).
  devIndicators: false,
};

export default nextConfig;
