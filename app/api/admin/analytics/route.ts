import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { NextResponse } from 'next/server';
import { getPool, ensureDb, hasDb } from '@/lib/db';
import { getAnalyticsClient, getAnalyticsPropertyId } from '@/lib/analytics';

const propertyId = getAnalyticsPropertyId();
const analyticsDataClient = getAnalyticsClient();

// Datos mock para el layout de vista previa visual
// Estos se usarán como respaldo si las credenciales de GA4 no están configuradas en el archivo .env
const mockDataMap: any = {
  today: {
    realtimeUsers: 3,
    realtimePage: 'Portafolio 3D & Hero',
    uniqueUsers: 24,
    newUsers: 18,
    returningUsers: 6,
    totalViews: 86,
    avgTime: '2m 18s',
    cvDownloads: 5,
    fullscreenOpens: 12,
    socialClicks: 8,
    emailClicks: 3,
    failedLogins: 0,
    socialList: [
      { name: 'Instagram', icon: 'fa-instagram', count: 5, pct: 62 },
      { name: 'LinkedIn', icon: 'fa-linkedin', count: 2, pct: 25 },
      { name: 'ArtStation', icon: 'fa-artstation', count: 1, pct: 13 },
      { name: 'YouTube', icon: 'fa-youtube', count: 0, pct: 0 },
    ],
    sections: [
      { name: '3D Generalist & Hero', path: '/', views: 38, pct: 44 },
      { name: 'Animations Showcase', path: '#animations', views: 24, pct: 28 },
      { name: 'Character Design', path: '#characters', views: 14, pct: 16 },
      { name: 'Illustrations Bento', path: '#illustrations', views: 10, pct: 12 },
    ],
    sources: [
      { name: 'Directo / URL', pct: 65, count: 15 },
      { name: 'Instagram', pct: 25, count: 6 },
      { name: 'LinkedIn', pct: 10, count: 3 },
    ],
    countries: [
      { code: 'UY', name: 'Uruguay', pct: 55, count: 13 },
      { code: 'AR', name: 'Argentina', pct: 30, count: 7 },
      { code: 'US', name: 'Estados Unidos', pct: 15, count: 4 },
    ],
    devices: { desktop: 55, mobile: 45 },
    chartDays: [
      { day: '00:00', val: 2 },
      { day: '04:00', val: 0 },
      { day: '08:00', val: 5 },
      { day: '12:00', val: 9 },
      { day: '16:00', val: 14 },
      { day: '20:00', val: 8 },
    ],
  },
  '7d': {
    realtimeUsers: 3,
    realtimePage: 'Portafolio 3D & Hero',
    uniqueUsers: 512,
    newUsers: 485,
    returningUsers: 27,
    totalViews: 1845,
    avgTime: '1m 45s',
    cvDownloads: 34,
    fullscreenOpens: 142,
    socialClicks: 65,
    emailClicks: 12,
    failedLogins: 2,
    socialList: [
      { name: 'Instagram', icon: 'fa-instagram', count: 42, pct: 64 },
      { name: 'LinkedIn', icon: 'fa-linkedin', count: 18, pct: 28 },
      { name: 'ArtStation', icon: 'fa-artstation', count: 3, pct: 5 },
      { name: 'YouTube', icon: 'fa-youtube', count: 2, pct: 3 },
    ],
    sections: [
      { name: '3D Generalist & Hero', path: '/', views: 218, pct: 42 },
      { name: 'Animations Showcase', path: '#animations', views: 145, pct: 28 },
      { name: 'Character Design', path: '#characters', views: 93, pct: 18 },
      { name: 'Illustrations Bento', path: '#illustrations', views: 64, pct: 12 },
    ],
    sources: [
      { name: 'Directo / URL', pct: 44, count: 255 },
      { name: 'Instagram', pct: 32, count: 185 },
      { name: 'LinkedIn', pct: 15, count: 87 },
      { name: 'Google Search', pct: 9, count: 53 },
    ],
    countries: [
      { code: 'UY', name: 'Uruguay', pct: 48, count: 278 },
      { code: 'AR', name: 'Argentina', pct: 24, count: 139 },
      { code: 'US', name: 'Estados Unidos', pct: 18, count: 104 },
      { code: 'ES', name: 'España', pct: 10, count: 59 },
    ],
    devices: { desktop: 62, mobile: 38 },
    chartDays: [
      { day: 'Lun', val: 18 },
      { day: 'Mar', val: 24 },
      { day: 'Mié', val: 31 },
      { day: 'Jue', val: 22 },
      { day: 'Vie', val: 29 },
      { day: 'Sáb', val: 35 },
      { day: 'Dom', val: 19 },
    ],
  },
  '30d': {
    realtimeUsers: 4,
    realtimePage: 'Ilustraciones Bento',
    uniqueUsers: 2154,
    newUsers: 1980,
    returningUsers: 174,
    totalViews: 8645,
    avgTime: '2m 10s',
    cvDownloads: 145,
    fullscreenOpens: 890,
    socialClicks: 320,
    emailClicks: 45,
    failedLogins: 0,
    socialList: [
      { name: 'Instagram', icon: 'fa-instagram', count: 180, pct: 56 },
      { name: 'LinkedIn', icon: 'fa-linkedin', count: 100, pct: 31 },
      { name: 'ArtStation', icon: 'fa-artstation', count: 30, pct: 10 },
      { name: 'YouTube', icon: 'fa-youtube', count: 10, pct: 3 },
    ],
    sections: [
      { name: '3D Generalist & Hero', path: '/', views: 903, pct: 42 },
      { name: 'Animations Showcase', path: '#animations', views: 602, pct: 28 },
      { name: 'Character Design', path: '#characters', views: 387, pct: 18 },
      { name: 'Illustrations Bento', path: '#illustrations', views: 258, pct: 12 },
    ],
    sources: [
      { name: 'Directo / URL', pct: 50, count: 1077 },
      { name: 'Instagram', pct: 25, count: 538 },
      { name: 'LinkedIn', pct: 15, count: 323 },
      { name: 'Google Search', pct: 10, count: 215 },
    ],
    countries: [
      { code: 'UY', name: 'Uruguay', pct: 50, count: 1077 },
      { code: 'AR', name: 'Argentina', pct: 20, count: 430 },
      { code: 'US', name: 'Estados Unidos', pct: 15, count: 323 },
      { code: 'ES', name: 'España', pct: 15, count: 323 },
    ],
    devices: { desktop: 70, mobile: 30 },
    chartDays: [
      { day: 'Semana 1', val: 125 },
      { day: 'Semana 2', val: 148 },
      { day: 'Semana 3', val: 162 },
      { day: 'Semana 4', val: 145 },
    ],
  }
}

import { requireRole } from '@/lib/auth';

/* Cache en memoria de los reportes históricos de GA, por rango de fechas.
   Vive en el proceso: alcanza para absorber el polling del panel y no
   introduce infraestructura. Al reiniciar arranca vacío, que es correcto. */
const REPORTS_TTL_MS = 5 * 60 * 1000;
const reportsCache = new Map<string, { at: number; value: Promise<unknown> }>();

function cachedReports<T>(key: string, run: () => Promise<T>): Promise<T> {
  const hit = reportsCache.get(key);
  if (hit && Date.now() - hit.at < REPORTS_TTL_MS) return hit.value as Promise<T>;
  const value = run();
  // Se guarda la promesa, no el resultado: dos requests simultáneos comparten
  // una sola llamada a GA en vez de disparar dos.
  reportsCache.set(key, { at: Date.now(), value });
  // Un fallo no se cachea: el próximo request reintenta contra GA.
  value.catch(() => reportsCache.delete(key));
  return value;
}

export async function GET(request: Request) {
  const auth = await requireRole(request, ['owner', 'admin', 'demo']);
  if ('deny' in auth) return auth.deny;

  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '7d';
  const realtimeOnly = searchParams.get('realtimeOnly') === 'true';

  if (auth.user.role === 'demo') {
    const data = { ...mockDataMap[range] || mockDataMap['30d'], failedLogins: 0 };
    return NextResponse.json({ data, _status: 'mock-demo' });
  }

  // Si estamos en entorno local de desarrollo (npm run dev), O si faltan las credenciales, usamos mock data
  if (process.env.NODE_ENV === 'development' || !analyticsDataClient || !propertyId) {
    let mockFailedLogins = 0;
    if (hasDb) {
      try {
        await ensureDb();
        const pool = getPool();
        if (pool) {
          const { rows } = await pool.query(
            'SELECT COUNT(*)::int as count FROM failed_logins WHERE created_at >= $1::date AND created_at <= $2::date',
            ['2024-01-01', '2027-12-31']
          );
          mockFailedLogins = rows[0]?.count || 0;
        }
      } catch (err) {
        console.error('Error fetching failed logins from DB (mock mode):', err);
      }
    }

    if (process.env.NODE_ENV !== 'development') {
      console.warn("GA4 Credentials missing. Using mock data.");
    }
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulamos latencia
    const data = { ...mockDataMap[range] || mockDataMap['30d'], failedLogins: mockFailedLogins };
    return NextResponse.json({ data, _status: 'mock' });
  }

  let startDate = '30daysAgo';
  let endDate = 'today';
  let timeDimension = 'date';

  const d = new Date();
  
  switch (range) {
    case 'today':
      startDate = 'today'; endDate = 'today'; timeDimension = 'hour';
      break;
    case 'yesterday':
      startDate = 'yesterday'; endDate = 'yesterday'; timeDimension = 'hour';
      break;
    case 'thisWeek': {
      const day = d.getDay();
      const diff = d.getDate() - day;
      const sun = new Date(d.setDate(diff));
      startDate = sun.toISOString().split('T')[0];
      endDate = 'today';
      break;
    }
    case '7daysAgo':
      startDate = '7daysAgo'; endDate = 'yesterday';
      break;
    case 'lastWeek': {
      const day = d.getDay();
      const lastSat = new Date(d);
      lastSat.setDate(d.getDate() - day - 1);
      endDate = lastSat.toISOString().split('T')[0];
      const lastSun = new Date(lastSat);
      lastSun.setDate(lastSat.getDate() - 6);
      startDate = lastSun.toISOString().split('T')[0];
      break;
    }
    case '28daysAgo':
      startDate = '28daysAgo'; endDate = 'yesterday';
      break;
    case '30daysAgo':
      startDate = '30daysAgo'; endDate = 'yesterday';
      break;
    case 'thisMonth':
      d.setDate(1);
      startDate = d.toISOString().split('T')[0];
      endDate = 'today';
      break;
    case 'lastMonth': {
      d.setDate(1);
      d.setHours(-1); // goes to last day of previous month
      endDate = d.toISOString().split('T')[0];
      d.setDate(1); // goes to first day of previous month
      startDate = d.toISOString().split('T')[0];
      break;
    }
    case '90daysAgo':
      startDate = '90daysAgo'; endDate = 'yesterday'; timeDimension = 'yearMonth';
      break;
    case 'thisQuarter': {
      const qMonth = Math.floor(d.getMonth() / 3) * 3;
      d.setMonth(qMonth, 1);
      startDate = d.toISOString().split('T')[0];
      endDate = 'today';
      timeDimension = 'yearMonth';
      break;
    }
    case 'thisYear':
      d.setMonth(0, 1);
      startDate = d.toISOString().split('T')[0];
      endDate = 'today';
      timeDimension = 'yearMonth';
      break;
    case 'lastYear': {
      d.setFullYear(d.getFullYear() - 1, 11, 31);
      endDate = d.toISOString().split('T')[0];
      d.setMonth(0, 1);
      startDate = d.toISOString().split('T')[0];
      timeDimension = 'yearMonth';
      break;
    }
    default:
      startDate = '30daysAgo'; endDate = 'yesterday';
      break;
  }

  try {
    // Realtime Pulse (Total Users)
    const realtimeReqTotal = analyticsDataClient.runRealtimeReport({
      property: `properties/${propertyId}`,
      metrics: [{ name: 'activeUsers' }]
    });

    // Realtime Pulse (Pages)
    const realtimeReqPages = analyticsDataClient.runRealtimeReport({
      property: `properties/${propertyId}`,
      metrics: [{ name: 'activeUsers' }],
      dimensions: [{ name: 'unifiedScreenName' }],
    });

    // Realtime Pulse (Countries)
    const realtimeReqCountries = analyticsDataClient.runRealtimeReport({
      property: `properties/${propertyId}`,
      metrics: [{ name: 'activeUsers' }],
      dimensions: [{ name: 'country' }],
    });

    const [
      realtimeResTotal,
      realtimeResPages,
      realtimeResCountries
    ] = await Promise.all([
      realtimeReqTotal,
      realtimeReqPages,
      realtimeReqCountries
    ]);

    const realtimeUsers = parseInt(realtimeResTotal[0].rows?.[0]?.metricValues?.[0]?.value || '0', 10);
    
    let realtimePages: {name: string, count: number}[] = [];
    if (realtimeResPages[0].rows && realtimeResPages[0].rows.length > 0) {
      const pageMap = new Map<string, number>();
      
      for (const r of realtimeResPages[0].rows) {
        let name = (r.dimensionValues?.[0].value || '(not set)').trim();
        const count = parseInt(r.metricValues?.[0].value || '0', 10);
        
        if (!name || name === '(not set)' || name === '(other)') continue;
        
        // Remove known prefixes to keep titles clean
        if (name.includes(' - ')) name = name.split(' - ')[0];
        if (name.includes(' | ')) name = name.split(' | ')[0];
        
        pageMap.set(name, (pageMap.get(name) || 0) + count);
      }
      
      realtimePages = Array.from(pageMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);
    }
    
    let realtimeCountries: {name: string, count: number}[] = [];
    if (realtimeResCountries[0].rows && realtimeResCountries[0].rows.length > 0) {
      const sortedCountries = [...realtimeResCountries[0].rows].sort((a, b) => {
        const countA = parseInt(a.metricValues?.[0].value || '0', 10);
        const countB = parseInt(b.metricValues?.[0].value || '0', 10);
        return countB - countA;
      });
      realtimeCountries = sortedCountries.map(r => ({
        name: r.dimensionValues?.[0].value || 'Desconocido',
        count: parseInt(r.metricValues?.[0].value || '0', 10)
      }));
    }

    if (realtimeOnly) {
      return NextResponse.json({
        data: {
          realtimeUsers,
          realtimePages,
          realtimeCountries,
          uniqueUsers: 0, newUsers: 0, returningUsers: 0, totalViews: 0, avgTime: '0s', cvDownloads: 0, fullscreenOpens: 0, socialClicks: 0, emailClicks: 0, failedLogins: 0, socialList: [], sections: [], trafficSources: [], dailyUsers: [], devices: []
        }
      });
    }

    // 1. General Overview
    const overviewReq = analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' }
      ],
    });

    // 2. Devices
    const devicesReq = analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'activeUsers' }]
    });

    // 3. Countries
    const countriesReq = analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'countryId' }, { name: 'country' }],
      metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }],
      limit: 15
    });

    // 4. Sources
    const sourcesReq = analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionSource' }],
      metrics: [{ name: 'activeUsers' }],
      limit: 10
    });

    // 5. Time Series (Chart)
    const timeReq = analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: timeDimension }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ dimension: { dimensionName: timeDimension } }]
    });

    // 6. Events
    const eventsReq = analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }]
    });

    /* Los 6 reportes históricos se cachean por rango: el panel poolea cada
       30 s y estos datos llegan hasta 'yesterday', o sea que cambian una vez
       por día. Sin cache eran 12 llamadas por minuto a la Data API de GA
       (que tiene cuota diaria) para devolver siempre lo mismo.
       El bloque realtime de arriba queda fuera del cache a propósito. */
    const [
      overviewRes,
      devicesRes,
      countriesRes,
      sourcesRes,
      timeRes,
      eventsRes
    ] = await cachedReports(`${range}:${startDate}:${endDate}`, () => Promise.all([
      overviewReq,
      devicesReq,
      countriesReq,
      sourcesReq,
      timeReq,
      eventsReq
    ]));

    // Process Overview
    const row = overviewRes[0].rows?.[0];
    const uniqueUsers = parseInt(row?.metricValues?.[0]?.value || '0', 10);
    const newUsers = parseInt(row?.metricValues?.[1]?.value || '0', 10);
    const totalViews = parseInt(row?.metricValues?.[2]?.value || '0', 10);
    const avgSec = parseFloat(row?.metricValues?.[3]?.value || '0');
    
    const mins = Math.floor(avgSec / 60);
    const secs = Math.floor(avgSec % 60);
    const returningUsers = Math.max(0, uniqueUsers - newUsers);

    // Process Devices
    let totalDevices = 0;
    const devicesData = { desktop: 0, mobile: 0 };
    devicesRes[0].rows?.forEach(r => {
      const category = r.dimensionValues?.[0].value?.toLowerCase();
      const users = parseInt(r.metricValues?.[0].value || '0', 10);
      totalDevices += users;
      if (category === 'desktop') devicesData.desktop += users;
      else devicesData.mobile += users; // mobile & tablet
    });
    const devices = {
      desktop: totalDevices ? Math.round((devicesData.desktop / totalDevices) * 100) : 0,
      mobile: totalDevices ? Math.round((devicesData.mobile / totalDevices) * 100) : 0
    };

    // Process Countries
    let totalCountriesUsers = 0;
    const countriesRaw = countriesRes[0].rows?.map(r => {
      const code = r.dimensionValues?.[0].value || 'XX';
      const name = r.dimensionValues?.[1].value || 'Unknown';
      const count = parseInt(r.metricValues?.[0].value || '0', 10);
      const newUsers = parseInt(r.metricValues?.[1].value || '0', 10);
      const returningUsers = Math.max(0, count - newUsers);
      totalCountriesUsers += count;
      return { code, name, count, newUsers, returningUsers };
    }) || [];
    const countries = countriesRaw.map(c => ({
      ...c,
      pct: totalCountriesUsers ? Math.round((c.count / totalCountriesUsers) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    // Process Sources
    let totalSourcesUsers = 0;
    const sourcesRaw = sourcesRes[0].rows?.map(r => {
      let name = r.dimensionValues?.[0].value || 'Directo';
      if (name === '(direct)') name = 'Directo / URL';
      const count = parseInt(r.metricValues?.[0].value || '0', 10);
      totalSourcesUsers += count;
      return { name, count };
    }) || [];
    const sources = sourcesRaw.map(s => ({
      ...s,
      pct: totalSourcesUsers ? Math.round((s.count / totalSourcesUsers) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    // Process Chart Days
    const chartDays = timeRes[0].rows?.map(r => {
      const dim = r.dimensionValues?.[0].value || '';
      let dayStr = dim;
      if (timeDimension === 'hour' || dim.length === 2) {
        dayStr = dim + ':00';
      } else if (dim.length === 8) {
        dayStr = dim.substring(6,8) + '/' + dim.substring(4,6);
      } else if (dim.length === 6) {
        dayStr = dim.substring(4,6) + '/' + dim.substring(0,4);
      }
      return {
        day: dayStr,
        val: parseInt(r.metricValues?.[0].value || '0', 10)
      };
    }) || [];

    // Process Events
    let cvDownloads = 0;
    let socialClicks = 0;
    let fullscreenOpens = 0;
    let emailClicks = 0;
    let socialListRaw: { id: string, count: number }[] = [];
    
    eventsRes[0].rows?.forEach(r => {
      const eventName = r.dimensionValues?.[0].value || '';
      const count = parseInt(r.metricValues?.[0].value || '0', 10);
      if (eventName === 'cv_download') cvDownloads += count;
      if (eventName === 'social_click') socialClicks += count; // Legacy fallback
      if (eventName === 'fullscreen_open') fullscreenOpens += count;
      if (eventName === 'email_click') emailClicks += count;
      
      // Parse specific social clicks
      if (eventName.startsWith('social_click_')) {
        const networkId = eventName.replace('social_click_', '');
        socialClicks += count;
        socialListRaw.push({ id: networkId, count });
      }
    });

    // Map network IDs to friendly names and icons
    const socialIcons: Record<string, string> = {
      instagram: 'fa-instagram', linkedin: 'fa-linkedin-in', artstation: 'fa-artstation',
      youtube: 'fa-youtube', vimeo: 'fa-vimeo-v', behance: 'fa-behance'
    };
    const socialNames: Record<string, string> = {
      instagram: 'Instagram', linkedin: 'LinkedIn', artstation: 'ArtStation',
      youtube: 'YouTube', vimeo: 'Vimeo', behance: 'Behance'
    };

    const socialList = socialListRaw.map(s => ({
      name: socialNames[s.id] || s.id,
      icon: socialIcons[s.id] || 'fa-link',
      count: s.count,
      pct: socialClicks > 0 ? Math.round((s.count / socialClicks) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    // Query local DB for failed logins
    let failedLogins = 0;
    if (hasDb) {
      try {
        await ensureDb();
        const pool = getPool();
        if (pool) {
          const resolveDbDate = (str: string) => {
            if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
            const dt = new Date();
            if (str === 'yesterday') dt.setDate(dt.getDate() - 1);
            else if (str === '7daysAgo') dt.setDate(dt.getDate() - 7);
            else if (str === '28daysAgo') dt.setDate(dt.getDate() - 28);
            else if (str === '30daysAgo') dt.setDate(dt.getDate() - 30);
            else if (str === '90daysAgo') dt.setDate(dt.getDate() - 90);
            return dt.toISOString().split('T')[0];
          };
          const { rows } = await pool.query(
            'SELECT COUNT(*)::int as count FROM failed_logins WHERE created_at::date >= $1::date AND created_at::date <= $2::date',
            [resolveDbDate(startDate), resolveDbDate(endDate)]
          );
          failedLogins = rows[0]?.count || 0;
        }
      } catch (err) {
        console.error('Error fetching failed logins from DB:', err);
      }
    }

    return NextResponse.json({
      data: {
        realtimeUsers,
        realtimePages,
        realtimeCountries,
        uniqueUsers,
        newUsers,
        returningUsers,
        totalViews,
        avgTime: `${mins}m ${secs}s`,
        devices,
        countries,
        sources,
        chartDays,
        cvDownloads,
        fullscreenOpens,
        socialClicks,
        emailClicks,
        failedLogins,
        socialList, // Desglose de redes detectadas a través de eventos social_click_X
        sections: [],
      },
      _status: 'connected'
    });

  } catch (err: any) {
    console.error('GA4 API Error:', err);
    const isDev = (process.env.NODE_ENV as string) === 'development';
    const safeMessage = isDev ? err.message : 'Analytics service error';
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
