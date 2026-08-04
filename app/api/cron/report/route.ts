import { NextResponse } from 'next/server';
import { getAnalyticsClient, getAnalyticsPropertyId } from '@/lib/analytics';
import { getPool, hasDb, ensureDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getDestinationEmails(): Promise<string[]> {
  if (!hasDb) return [];
  const pool = getPool()!;
  const { rows } = await pool.query(
    "SELECT value FROM cms_data WHERE key = 'social.email'",
  );
  const val = (rows[0]?.value || '').trim();
  if (!val) return [];
  return val
    .split(',')
    .map((e: string) => e.trim())
    .filter((e: string) => EMAIL_RE.test(e));
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0s';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export async function GET(req: Request) {
  // 1. Validar seguridad (CRON_SECRET o Sesión Admin)
  const cronSecret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const secretQuery = url.searchParams.get('secret');
  const preview = url.searchParams.get('preview') === 'true';
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  let isAuthorized = false;
  if (cronSecret && (secretQuery === cronSecret || bearerToken === cronSecret)) {
    isAuthorized = true;
  } else {
    try {
      const auth = await requireRole(req, ['owner', 'admin']);
      if (!('deny' in auth)) isAuthorized = true;
    } catch {
      // Ignorar
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Verificar que GA4 esté configurado
  const analyticsClient = getAnalyticsClient();
  const propertyId = getAnalyticsPropertyId();
  if (!analyticsClient || !propertyId) {
    return NextResponse.json({ error: 'Google Analytics no configurado' }, { status: 500 });
  }

  // 3. Obtener datos de Google Analytics (últimos 7 días)
  const metricsData = {
    users: 0,
    newUsers: 0,
    views: 0,
    avgDuration: '0s',
    topPages: [] as {name: string, views: number}[],
    topCountries: [] as {name: string, users: number}[],
    cvDownloads: 0,
    emailClicks: 0,
    socialClicks: 0,
    contactMessages: 0,
  };

  try {
    const [overviewRes, pagesRes, countriesRes, eventsRes] = await Promise.all([
      analyticsClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'newUsers' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
        ],
      }),
      analyticsClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'unifiedScreenName' }],
        metrics: [{ name: 'screenPageViews' }],
        limit: 10,
      }),
      analyticsClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }],
        limit: 3,
      }),
      analyticsClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }]
      })
    ]);

    if (overviewRes[0].rows && overviewRes[0].rows.length > 0) {
      const row = overviewRes[0].rows[0];
      metricsData.users = parseInt(row.metricValues?.[0]?.value || '0', 10);
      metricsData.newUsers = parseInt(row.metricValues?.[1]?.value || '0', 10);
      metricsData.views = parseInt(row.metricValues?.[2]?.value || '0', 10);
      metricsData.avgDuration = formatDuration(parseFloat(row.metricValues?.[3]?.value || '0'));
    }

    if (pagesRes[0].rows) {
      const pageMap = new Map<string, number>();
      for (const r of pagesRes[0].rows) {
        const name = (r.dimensionValues?.[0]?.value || '(not set)').split(' - ')[0].split(' | ')[0].trim();
        const views = parseInt(r.metricValues?.[0]?.value || '0', 10);
        if (name && name !== '(not set)' && name !== '(other)') {
          pageMap.set(name, (pageMap.get(name) || 0) + views);
        }
      }
      metricsData.topPages = Array.from(pageMap.entries())
        .map(([name, views]) => ({ name, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 5);
    }

    if (countriesRes[0].rows) {
      metricsData.topCountries = countriesRes[0].rows.map(r => ({
        name: r.dimensionValues?.[0]?.value || 'Desconocido',
        users: parseInt(r.metricValues?.[0]?.value || '0', 10)
      }));
    }

    if (eventsRes[0].rows) {
      eventsRes[0].rows.forEach(r => {
        const eventName = r.dimensionValues?.[0]?.value || '';
        const count = parseInt(r.metricValues?.[0]?.value || '0', 10);
        if (eventName === 'cv_download') metricsData.cvDownloads += count;
        if (eventName === 'email_click') metricsData.emailClicks += count;
        if (eventName === 'social_click' || eventName.startsWith('social_click_')) {
          metricsData.socialClicks += count;
        }
      });
    }
  } catch (error) {
    console.error('[cron/report] Error fetching from GA4', error);
    return NextResponse.json({ error: 'Fallo al obtener datos de GA4' }, { status: 500 });
  }

  // 4. Enviar email (si hay correos configurados y Resend)
  await ensureDb();
  
  if (hasDb) {
    try {
      const pool = getPool()!;
      const { rows } = await pool.query(
        "SELECT COUNT(*)::int as count FROM contact_messages WHERE created_at >= NOW() - INTERVAL '7 days'"
      );
      metricsData.contactMessages = rows[0]?.count || 0;
    } catch (e) {
      console.error('[cron/report] DB Error:', e);
    }
  }

  const destEmails = await getDestinationEmails();
  const resendKey = process.env.RESEND_API_KEY;

  if (!preview && (destEmails.length === 0 || !resendKey)) {
    return NextResponse.json({ 
      success: true, 
      message: 'Reporte generado pero no se pudo enviar (falta email destino o Resend Key)',
      data: metricsData 
    });
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(resendKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    const htmlContent = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #8b5cf6; margin-bottom: 4px;">Tu reporte de tráfico semanal</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 0;">Resumen de los últimos 7 días de tu portfolio.</p>
          <hr style="border: none; border-top: 2px solid #8b5cf6; margin: 16px 0 24px;">
          
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
            <table style="width: 100%; text-align: left; border-collapse: collapse;">
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                  <strong style="color: #334155; font-size: 16px;">👤 Usuarios activos:</strong>
                </td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                  <span style="font-size: 18px; font-weight: bold; color: #8b5cf6;">${metricsData.users}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                  <strong style="color: #334155; font-size: 16px;">✨ Nuevos usuarios:</strong>
                </td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                  <span style="font-size: 18px; font-weight: bold; color: #10b981;">${metricsData.newUsers}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                  <strong style="color: #334155; font-size: 16px;">👀 Vistas totales:</strong>
                </td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                  <span style="font-size: 18px; font-weight: bold; color: #8b5cf6;">${metricsData.views}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 0;">
                  <strong style="color: #334155; font-size: 16px;">⏱️ Tiempo promedio:</strong>
                </td>
                <td style="padding: 12px 0; text-align: right;">
                  <span style="font-size: 18px; font-weight: bold; color: #3b82f6;">${metricsData.avgDuration}</span>
                </td>
              </tr>
            </table>
          </div>

          ${metricsData.topPages.length > 0 ? `
          <div style="margin-top: 24px;">
            <h3 style="color: #334155; font-size: 16px; margin-bottom: 12px;">📄 Top Páginas (Más vistas)</h3>
            <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px;">
              ${metricsData.topPages.map(p => `<li style="margin-bottom: 4px;"><strong>${p.name}</strong>: ${p.views} vistas</li>`).join('')}
            </ul>
          </div>
          ` : ''}

          ${metricsData.topCountries.length > 0 ? `
          <div style="margin-top: 24px;">
            <h3 style="color: #334155; font-size: 16px; margin-bottom: 12px;">🌍 Top Países</h3>
            <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px;">
              ${metricsData.topCountries.map(c => `<li style="margin-bottom: 4px;"><strong>${c.name}</strong>: ${c.users} usuarios</li>`).join('')}
            </ul>
          </div>
          ` : ''}

          <div style="margin-top: 24px;">
            <h3 style="color: #334155; font-size: 16px; margin-bottom: 12px;">🎯 Eventos Clave</h3>
            <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
              <tr>
                <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0;">📧 Correos enviados / Clics en email</td>
                <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #8b5cf6;">${metricsData.emailClicks}</td>
              </tr>
              <tr>
                <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0;">📥 Mensajes recibidos (Formulario)</td>
                <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #f59e0b;">${metricsData.contactMessages}</td>
              </tr>
              <tr>
                <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0;">📄 Descargas de CV</td>
                <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #10b981;">${metricsData.cvDownloads}</td>
              </tr>
              <tr>
                <td style="padding: 10px 16px;">🔗 Clics en Redes Sociales</td>
                <td style="padding: 10px 16px; text-align: right; font-weight: bold; color: #3b82f6;">${metricsData.socialClicks}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; text-align: center;">
            Este es un reporte automático generado por tu Portfolio.<br>
            Para ver más detalles, ingresá al panel de administración.
          </p>
        </div>
      `;

    if (preview) {
      return new NextResponse(htmlContent, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    await resend.emails.send({
      from: `Portfolio Analytics <${fromEmail}>`,
      to: destEmails,
      subject: `[Portfolio] Reporte Semanal de Tráfico`,
      html: htmlContent,
    });
  } catch (err) {
    console.error('[cron/report] Resend error:', err);
    return NextResponse.json({ error: 'Fallo al enviar el reporte por email' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: metricsData });
}
