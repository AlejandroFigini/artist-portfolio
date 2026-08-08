import type { NextConfig } from "next";

// La API vive dentro de Next (app/api/*). No hay proxy ni backend Express aparte.
const nextConfig: NextConfig = {
  // Optimización para contenedores (Coolify/Docker/Railway): reduce consumo de memoria.
  output: "standalone",
  // Oculta el indicador flotante de Next.js Dev Tools (la "N" en dev).
  devIndicators: false,
  images: {
    /* AVIF primero, WebP de respaldo. Por defecto Next solo sirve WebP.
       Medido sobre las imágenes reales del sitio, el ahorro es modesto y CRECE
       con el tamaño: 0-3% a 640px, 2-9% a 828px, 5-14% a 1080px. En los tamaños
       chicos a veces AVIF pesa un poco más. Se deja porque en un portfolio de
       arte las imágenes grandes son el contenido y ahí es donde rinde.
       Contrapartida real: codificar AVIF cuesta más CPU que WebP y Railway va
       justo de CPU, así que el PRIMER request de cada tamaño es más lento. Next
       cachea el resultado y el edge lo sirve `immutable`, así que se paga una
       vez por variante.
       No se tocan `deviceSizes` ni `imageSizes`: lib/utils.ts arma las URLs a
       mano contra la lista por defecto y cambiarla acá devolvería 400. */
    formats: ['image/avif', 'image/webp'],
  },
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
