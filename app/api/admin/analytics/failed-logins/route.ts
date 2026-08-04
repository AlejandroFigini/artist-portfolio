import { NextResponse } from 'next/server';
import { getPool, hasDb, ensureDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/* Devuelve intentos de login fallidos: usuarios probados, IPs y user-agents.
   Antes solo comprobaba que la cookie `sid` EXISTIERA, sin validarla: cualquiera
   con `Cookie: sid=loquesea` se llevaba la lista. Ahora se valida la sesión
   contra la tabla y se exige rol; el rol demo no ve datos reales. */
export async function GET(request: Request) {
  const auth = await requireRole(request, ['owner', 'admin', 'demo']);
  if ('deny' in auth) return auth.deny;
  if (auth.user.role === 'demo') return NextResponse.json({ data: [] });

  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '30daysAgo';
  
  let startDateStr = '30daysAgo';
  let endDateStr = 'today';
  
  const d = new Date();
  switch (range) {
    case 'today':
      startDateStr = 'today'; endDateStr = 'today';
      break;
    case 'yesterday':
      startDateStr = 'yesterday'; endDateStr = 'yesterday';
      break;
    case 'thisWeek': {
      const day = d.getDay();
      const diff = d.getDate() - day;
      const sun = new Date(d.setDate(diff));
      startDateStr = sun.toISOString().split('T')[0];
      endDateStr = 'today';
      break;
    }
    case '7daysAgo':
      startDateStr = '7daysAgo'; endDateStr = 'yesterday';
      break;
    case 'lastWeek': {
      const day = d.getDay();
      const lastSat = new Date(d);
      lastSat.setDate(d.getDate() - day - 1);
      endDateStr = lastSat.toISOString().split('T')[0];
      const lastSun = new Date(lastSat);
      lastSun.setDate(lastSat.getDate() - 6);
      startDateStr = lastSun.toISOString().split('T')[0];
      break;
    }
    case '28daysAgo':
      startDateStr = '28daysAgo'; endDateStr = 'yesterday';
      break;
    case '30daysAgo':
      startDateStr = '30daysAgo'; endDateStr = 'yesterday';
      break;
    case 'thisMonth':
      d.setDate(1);
      startDateStr = d.toISOString().split('T')[0];
      endDateStr = 'today';
      break;
    case 'lastMonth': {
      d.setDate(1);
      d.setHours(-1);
      endDateStr = d.toISOString().split('T')[0];
      d.setDate(1);
      startDateStr = d.toISOString().split('T')[0];
      break;
    }
    case '90daysAgo':
      startDateStr = '90daysAgo'; endDateStr = 'yesterday';
      break;
    case 'thisQuarter': {
      const qMonth = Math.floor(d.getMonth() / 3) * 3;
      d.setMonth(qMonth, 1);
      startDateStr = d.toISOString().split('T')[0];
      endDateStr = 'today';
      break;
    }
    case 'thisYear':
      d.setMonth(0, 1);
      startDateStr = d.toISOString().split('T')[0];
      endDateStr = 'today';
      break;
    case 'lastYear': {
      d.setFullYear(d.getFullYear() - 1, 11, 31);
      endDateStr = d.toISOString().split('T')[0];
      d.setFullYear(d.getFullYear(), 0, 1);
      startDateStr = d.toISOString().split('T')[0];
      break;
    }
  }

  if (!hasDb) {
    return NextResponse.json({ data: [] });
  }

  try {
    await ensureDb();
    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'DB not available' }, { status: 500 });
    }

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

    /* Rango sobre el timestamp crudo, no `created_at::date`: el cast
       impide usar el índice y fuerza seq scan. El `< fin + 1 día` cubre
       el día final completo, igual que hacía el `<=` sobre la fecha. */
    const { rows } = await pool.query(
      `SELECT id, username, ip_address, user_agent, created_at
         FROM failed_logins
        WHERE created_at >= $1::date
          AND created_at < ($2::date + INTERVAL '1 day')
        ORDER BY created_at DESC
        LIMIT 50`,
      [resolveDbDate(startDateStr), resolveDbDate(endDateStr)]
    );

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('Error fetching failed logins list:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
