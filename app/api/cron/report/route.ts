import { NextResponse } from 'next/server';
import { getAnalyticsClient, getAnalyticsPropertyId } from '@/lib/analytics';
import { getPool, hasDb, ensureDb } from '@/lib/db';

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
  // 1. Validar seguridad (CRON_SECRET)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 });
  }

  const url = new URL(req.url);
  const secretQuery = url.searchParams.get('secret');
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (secretQuery !== cronSecret && bearerToken !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Verificar que GA4 esté configurado
  const analyticsClient = getAnalyticsClient();
  const propertyId = getAnalyticsPropertyId();
  if (!analyticsClient || !propertyId) {
    return NextResponse.json({ error: 'Google Analytics no configurado' }, { status: 500 });
  }

  // 3. Obtener datos de Google Analytics (últimos 7 días)
  let metricsData = {
    users: 0,
    newUsers: 0,
    views: 0,
    avgDuration: '0s',
  };

  try {
    const [response] = await analyticsClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
      ],
    });

    if (response.rows && response.rows.length > 0) {
      const row = response.rows[0];
      metricsData = {
        users: parseInt(row.metricValues?.[0]?.value || '0', 10),
        newUsers: parseInt(row.metricValues?.[1]?.value || '0', 10),
        views: parseInt(row.metricValues?.[2]?.value || '0', 10),
        avgDuration: formatDuration(parseFloat(row.metricValues?.[3]?.value || '0')),
      };
    }
  } catch (error) {
    console.error('[cron/report] Error fetching from GA4', error);
    return NextResponse.json({ error: 'Fallo al obtener datos de GA4' }, { status: 500 });
  }

  // 4. Enviar email (si hay correos configurados y Resend)
  await ensureDb();
  const destEmails = await getDestinationEmails();
  const resendKey = process.env.RESEND_API_KEY;

  if (destEmails.length === 0 || !resendKey) {
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

    await resend.emails.send({
      from: `Portfolio Analytics <${fromEmail}>`,
      to: destEmails,
      subject: `[Portfolio] Reporte Semanal de Tráfico`,
      html: `
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
          
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; text-align: center;">
            Este es un reporte automático generado por tu Portfolio.<br>
            Para ver más detalles, ingresá al panel de administración.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[cron/report] Resend error:', err);
    return NextResponse.json({ error: 'Fallo al enviar el reporte por email' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: metricsData });
}
