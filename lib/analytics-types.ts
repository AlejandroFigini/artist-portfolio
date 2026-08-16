/* Forma de los datos de analítica: la comparten el endpoint que los arma
   (app/api/admin/analytics) y el panel que los pinta (AnalyticsSection).
   Vive en su propio archivo, sin imports, para que el cliente lo pueda usar
   sin arrastrar el SDK de Google Analytics (que es solo de servidor).

   Antes cada lado lo trataba como `any`, así que un cambio de forma en el
   endpoint no rompía nada en compilación y aparecía como celda vacía en el panel. */

export type NamedCount = { name: string; count: number }

/* newUsers/returningUsers solo vienen del reporte real de GA; el mock no los
   trae, y el panel ya cae a 0 cuando faltan. Por eso son opcionales. */
export type CountryStat = {
  code: string
  name: string
  count: number
  pct: number
  newUsers?: number
  returningUsers?: number
}

export type SourceStat = { name: string; count: number; pct: number }

export type SocialStat = { name: string; icon: string; count: number; pct: number }

export type SectionStat = { name: string; path: string; views: number; pct: number }

export type ChartDay = { day: string; val: number }

export type DeviceSplit = { desktop: number; mobile: number }

export type AnalyticsData = {
  realtimeUsers: number
  realtimePages: NamedCount[]
  realtimeCountries: NamedCount[]
  uniqueUsers: number
  newUsers: number
  returningUsers: number
  totalViews: number
  avgTime: string
  devices: DeviceSplit
  countries: CountryStat[]
  sources: SourceStat[]
  chartDays: ChartDay[]
  cvDownloads: number
  fullscreenOpens: number
  socialClicks: number
  contactMessages: number
  failedLogins: number
  socialList: SocialStat[]
  sections: SectionStat[]
}

/* El mock rellena solo lo que el panel dibuja; el resto se completa al
   serializar. Por eso es Partial salvo las claves que el panel siempre lee. */
export type MockAnalyticsData = Partial<AnalyticsData> &
  Pick<AnalyticsData, 'uniqueUsers' | 'totalViews' | 'chartDays' | 'socialList' | 'sections'>

export type FailedLogin = {
  id: number
  username: string
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export type CountryMetric = 'active' | 'new' | 'returning'
