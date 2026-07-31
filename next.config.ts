import type { NextConfig } from "next";

// La API vive dentro de Next (app/api/*). No hay proxy ni backend Express aparte.
const nextConfig: NextConfig = {
  // Optimización para contenedores (Coolify/Docker/Railway): reduce consumo de memoria.
  output: "standalone",
  // Oculta el indicador flotante de Next.js Dev Tools (la "N" en dev).
  devIndicators: false,
  // Security headers como respaldo (el proxy.ts también los setea, pero estos
  // cubren archivos estáticos y rutas que el proxy no matchea).
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
  // bcryptjs funciona mejor cuando Node.js lo resuelve fuera del bundle de webpack.
  serverExternalPackages: ['bcryptjs', 'resend'],
};

export default nextConfig;
