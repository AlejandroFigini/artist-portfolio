/* Enlaces a la consola de Cloudinary. Una sola definición: el identificador de
   cuenta estaba copiado en dos componentes y las URLs no coincidían (una abría
   el buscador, la otra la ficha del asset). */

const CONSOLE_ROOT = 'https://console.cloudinary.com/app/c-a240be86a764a00eb530a9f52db056/assets/media_library'

/** Ficha del asset abierta en su pestaña Summary — es lo que se quiere al pulsar
 *  "Manage asset". Requiere el `asset_id` de Cloudinary (no el public_id). */
export function cloudinaryAssetUrl(assetId: string): string {
  return `${CONSOLE_ROOT}/search/asset/${encodeURIComponent(assetId)}/manage/summary?q=&view_mode=mosaic&context=manage`
}

/** Buscador por nombre. Solo como respaldo cuando no se pudo resolver el
 *  `asset_id` (asset local, Cloudinary sin configurar, red caída). */
export function cloudinarySearchUrl(query: string): string {
  return `${CONSOLE_ROOT}/search?q=${encodeURIComponent(query)}`
}
