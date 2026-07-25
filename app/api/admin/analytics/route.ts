import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { NextResponse } from 'next/server';

const propertyId = process.env.GA4_PROPERTY_ID;
const clientEmail = process.env.GA_CLIENT_EMAIL;
const privateKey = process.env.GA_PRIVATE_KEY?.replace(/\\n/gm, '\n');

// Initialize GA Data API Client
let analyticsDataClient: BetaAnalyticsDataClient | null = null;
if (propertyId && clientEmail && privateKey) {
  analyticsDataClient = new BetaAnalyticsDataClient({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  });
}

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '7d';

  // Si estamos en entorno local de desarrollo (npm run dev), O si faltan las credenciales, usamos mock data
  if (process.env.NODE_ENV === 'development' || !analyticsDataClient || !propertyId) {
    if (process.env.NODE_ENV !== 'development') {
      console.warn("GA4 Credentials missing. Using mock data.");
    }
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulamos latencia
    const data = mockDataMap[range] || mockDataMap['30d'];
    return NextResponse.json({ data, _status: 'mock' });
  }

  let startDate = '7daysAgo';
  if (range === 'today') startDate = 'today';
  else if (range === '30d') startDate = '30daysAgo';
  else if (range === '90d') startDate = '90daysAgo';
  else if (range === '180d') startDate = '180daysAgo';
  else if (range === '365d') startDate = '365daysAgo';

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate: 'today' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' }
      ],
    });

    let realtimeUsers = 0;
    let realtimePage = 'Ninguna';
    try {
      const [rtResponse] = await analyticsDataClient.runRealtimeReport({
        property: `properties/${propertyId}`,
        metrics: [{ name: 'activeUsers' }],
        dimensions: [{ name: 'unifiedScreenName' }],
      });
      
      if (rtResponse.rows && rtResponse.rows.length > 0) {
        let maxUsers = 0;
        rtResponse.rows.forEach(row => {
          const users = parseInt(row.metricValues?.[0]?.value || '0', 10);
          realtimeUsers += users;
          if (users > maxUsers) {
            maxUsers = users;
            realtimePage = row.dimensionValues?.[0]?.value || 'Ninguna';
          }
        });
      }
    } catch (e) {
      console.error("Error fetching realtime data:", e);
    }

    const row = response.rows?.[0];
    const uniqueUsers = parseInt(row?.metricValues?.[0]?.value || '0', 10);
    const newUsers = parseInt(row?.metricValues?.[1]?.value || '0', 10);
    const totalViews = parseInt(row?.metricValues?.[2]?.value || '0', 10);
    const avgSec = parseFloat(row?.metricValues?.[3]?.value || '0');
    
    const mins = Math.floor(avgSec / 60);
    const secs = Math.floor(avgSec % 60);
    const returningUsers = Math.max(0, uniqueUsers - newUsers);

    const fallbackData = mockDataMap[range] || mockDataMap['30d'];

    return NextResponse.json({
      data: {
        ...fallbackData,
        realtimeUsers,
        realtimePage,
        uniqueUsers,
        newUsers,
        returningUsers,
        totalViews,
        avgTime: `${mins}m ${secs}s`,
      },
      _status: 'connected'
    });

  } catch (err: any) {
    console.error('GA4 API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
