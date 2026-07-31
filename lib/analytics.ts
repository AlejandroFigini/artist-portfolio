import { BetaAnalyticsDataClient } from '@google-analytics/data';

/**
 * Retorna una instancia configurada de BetaAnalyticsDataClient si las 
 * credenciales están disponibles en el entorno. De lo contrario retorna null.
 */
export function getAnalyticsClient(): BetaAnalyticsDataClient | null {
  let clientEmail = process.env.GA_CLIENT_EMAIL;
  let privateKey = process.env.GA_PRIVATE_KEY || '';

  // Si el usuario guardó el JSON completo en una variable (mucho más seguro contra errores de formato en Railway)
  if (process.env.GA_CREDENTIALS_JSON) {
    try {
      const creds = JSON.parse(process.env.GA_CREDENTIALS_JSON);
      if (creds.client_email) clientEmail = creds.client_email;
      if (creds.private_key) privateKey = creds.private_key;
    } catch (e) {
      console.error("Error parsing GA_CREDENTIALS_JSON", e);
    }
  }

  if (privateKey) {
    // Elimina comillas dobles al principio y al final
    privateKey = privateKey.replace(/^"|"$/g, '');
    // Reemplaza los saltos de línea literales (\n) por saltos de línea reales
    privateKey = privateKey.replace(/\\n/gm, '\n');
  }

  if (process.env.GA4_PROPERTY_ID && clientEmail && privateKey) {
    return new BetaAnalyticsDataClient({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
    });
  }

  return null;
}

/**
 * Retorna el Property ID de GA4 configurado.
 */
export function getAnalyticsPropertyId(): string | undefined {
  return process.env.GA4_PROPERTY_ID;
}
