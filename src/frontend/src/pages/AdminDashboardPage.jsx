import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

const ADMIN_AUTH_KEY = 'adminAuthHeader';

const COLORS = {
  coral: '#FF6F91',
  gold: '#FFC75F',
  plum: '#2E1F3B',
  cream: '#FFFBF5',
  errorRed: '#D64545',
  white: '#FFFFFF',
};

const styles = {
  page: {
    minHeight: '100vh',
    background: COLORS.cream,
    color: COLORS.plum,
    fontFamily: "'Poppins', system-ui, -apple-system, sans-serif",
    padding: '24px 16px 80px',
    boxSizing: 'border-box',
  },
  loginWrap: {
    maxWidth: 400,
    margin: '10vh auto 0',
    background: COLORS.white,
    borderRadius: 16,
    padding: '32px 28px',
    boxShadow: '0 8px 24px rgba(46,31,59,0.12)',
  },
  logoRow: {
    textAlign: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: COLORS.plum,
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: '#8A7A97',
    marginTop: 6,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    marginTop: 16,
    color: COLORS.plum,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #E7DCEE',
    fontSize: 15,
    outline: 'none',
    background: COLORS.cream,
    color: COLORS.plum,
  },
  errorText: {
    color: COLORS.errorRed,
    fontSize: 13,
    marginTop: 10,
  },
  button: {
    width: '100%',
    marginTop: 22,
    padding: '12px 16px',
    borderRadius: 12,
    border: 'none',
    background: COLORS.coral,
    color: COLORS.white,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  buttonDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  dashboardWrap: {
    maxWidth: 960,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  logoutBtn: {
    padding: '8px 16px',
    borderRadius: 10,
    border: `1px solid ${COLORS.plum}`,
    background: 'transparent',
    color: COLORS.plum,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    background: COLORS.white,
    borderRadius: 16,
    padding: '20px 18px',
    boxShadow: '0 4px 14px rgba(46,31,59,0.08)',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#8A7A97',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 30,
    fontWeight: 800,
    color: COLORS.plum,
    marginTop: 6,
  },
  statAccentGold: {
    color: '#B8860F',
  },
  statAccentCoral: {
    color: COLORS.coral,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    margin: '32px 0 12px',
    color: COLORS.plum,
  },
  compareRow: {
    display: 'flex',
    gap: 24,
    flexWrap: 'wrap',
    background: COLORS.white,
    borderRadius: 16,
    padding: '20px 18px',
    boxShadow: '0 4px 14px rgba(46,31,59,0.08)',
    marginBottom: 8,
  },
  compareItem: {
    flex: '1 1 200px',
  },
  barTrack: {
    width: '100%',
    height: 10,
    borderRadius: 6,
    background: '#F1E7F5',
    overflow: 'hidden',
    marginTop: 8,
  },
  tableWrap: {
    background: COLORS.white,
    borderRadius: 16,
    padding: '8px 18px 16px',
    boxShadow: '0 4px 14px rgba(46,31,59,0.08)',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    color: '#8A7A97',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    borderBottom: '1px solid #F1E7F5',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 8px',
    borderBottom: '1px solid #F7F1FA',
    whiteSpace: 'nowrap',
  },
  emptyState: {
    padding: '16px 8px',
    color: '#8A7A97',
    fontSize: 14,
  },
  loadingWrap: {
    textAlign: 'center',
    padding: '60px 20px',
    color: COLORS.plum,
  },
  footerLink: {
    display: 'inline-block',
    marginTop: 40,
    color: COLORS.coral,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
  },
};

function encodeBasicAuth(username, password) {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

function formatNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '0';
  return Number(n).toLocaleString();
}

function BarCompare({ overall, unique }) {
  const max = Math.max(overall, unique, 1);
  return (
    <div style={styles.compareRow}>
      <div style={styles.compareItem}>
        <div style={styles.statLabel}>Overall Views</div>
        <div style={{ ...styles.statValue, ...styles.statAccentCoral }}>
          {formatNumber(overall)}
        </div>
        <div style={styles.barTrack}>
          <div
            style={{
              width: `${(overall / max) * 100}%`,
              height: '100%',
              background: COLORS.coral,
            }}
          />
        </div>
      </div>
      <div style={styles.compareItem}>
        <div style={styles.statLabel}>Unique Device Views</div>
        <div style={{ ...styles.statValue, ...styles.statAccentGold }}>
          {formatNumber(unique)}
        </div>
        <div style={styles.barTrack}>
          <div
            style={{
              width: `${(unique / max) * 100}%`,
              height: '100%',
              background: COLORS.gold,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function BreakdownTable({ title, rows, periodLabel }) {
  return (
    <>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.tableWrap}>
        {rows && rows.length > 0 ? (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{periodLabel}</th>
                <th style={styles.th}>Cards Created</th>
                <th style={styles.th}>Views</th>
                <th style={styles.th}>Unique Views</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.period}>
                  <td style={styles.td}>{row.period}</td>
                  <td style={styles.td}>{formatNumber(row.cardsCreated)}</td>
                  <td style={styles.td}>{formatNumber(row.views)}</td>
                  <td style={styles.td}>{formatNumber(row.uniqueViews)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={styles.emptyState}>No data yet.</div>
        )}
      </div>
    </>
  );
}

function normalizeBreakdown(list, periodKey) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => ({
    period: item[periodKey] ?? item.period ?? '',
    cardsCreated: item.cardsCreated ?? item.cards_created ?? 0,
    views: item.views ?? item.viewCount ?? 0,
    uniqueViews: item.uniqueViews ?? item.unique_views ?? item.uniqueDeviceViews ?? 0,
  }));
}

export default function AdminDashboardPage() {
  const [authHeader, setAuthHeader] = useState(
    () => sessionStorage.getItem(ADMIN_AUTH_KEY) || null
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');

  const fetchStats = useCallback(async (header) => {
    setStatsLoading(true);
    setStatsError('');
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'GET',
        headers: {
          Authorization: header,
        },
      });

      if (res.status === 401 || res.status === 403) {
        sessionStorage.removeItem(ADMIN_AUTH_KEY);
        setAuthHeader(null);
        setStats(null);
        setLoginError('Session expired. Please log in again.');
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to load dashboard stats (${res.status})`);
      }

      const data = await res.json();
      setStats(data);
    } catch (err) {
      setStatsError(err.message || 'Failed to load dashboard stats.');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authHeader) {
      fetchStats(authHeader);
    }
  }, [authHeader, fetchStats]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (!username.trim() || !password) {
      setLoginError('Please enter both username and password.');
      return;
    }

    setLoginLoading(true);
    const header = encodeBasicAuth(username.trim(), password);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          Authorization: header,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (res.status === 401 || res.status === 403) {
        setLoginError('Invalid username or password.');
        return;
      }

      if (!res.ok) {
        throw new Error(`Login failed (${res.status})`);
      }

      sessionStorage.setItem(ADMIN_AUTH_KEY, header);
      setAuthHeader(header);
      setPassword('');
    } catch (err) {
      setLoginError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    setAuthHeader(null);
    setStats(null);
    setUsername('');
    setPassword('');
    setLoginError('');
    setStatsError('');
  };

  if (!authHeader) {
    return (
      <div style={styles.page}>
        <div style={styles.loginWrap}>
          <div style={styles.logoRow}>
            <h1 style={styles.title}>Admin Login</h1>
            <div style={styles.subtitle}>Sign in to view dashboard stats</div>
          </div>
          <form onSubmit={handleLogin}>
            <label style={styles.label} htmlFor="admin-username">
              Username
            </label>
            <input
              id="admin-username"
              type="text"
              autoComplete="username"
              style={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loginLoading}
            />

            <label style={styles.label} htmlFor="admin-password">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              style={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loginLoading}
            />

            {loginError && <div style={styles.errorText}>{loginError}</div>}

            <button
              type="submit"
              style={{
                ...styles.button,
                ...(loginLoading ? styles.buttonDisabled : {}),
              }}
              disabled={loginLoading}
            >
              {loginLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const totalCards = stats?.totalCards ?? 0;
  const totalViews = stats?.totalViews ?? 0;
  const totalUniqueViews = stats?.totalUniqueViews ?? stats?.totalUniqueDeviceViews ?? 0;
  const byDay = normalizeBreakdown(stats?.byDay, 'date');
  const byWeek = normalizeBreakdown(stats?.byWeek, 'week');

  return (
    <div style={styles.page}>
      <div style={styles.dashboardWrap}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Admin Dashboard</h1>
            <div style={styles.subtitle}>Card creation &amp; view analytics</div>
          </div>
          <button type="button" style={styles.logoutBtn} onClick={handleLogout}>
            Log Out
          </button>
        </div>

        {statsLoading && (
          <div style={styles.loadingWrap}>Loading dashboard stats...</div>
        )}

        {!statsLoading && statsError && (
          <div style={styles.errorText}>{statsError}</div>
        )}

        {!statsLoading && !statsError && stats && (
          <>
            <div style={styles.statsRow}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Total Cards Created</div>
                <div style={styles.statValue}>{formatNumber(totalCards)}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Total Views (Lifetime)</div>
                <div style={{ ...styles.statValue, ...styles.statAccentCoral }}>
                  {formatNumber(totalViews)}
                </div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Unique Device Views</div>
                <div style={{ ...styles.statValue, ...styles.statAccentGold }}>
                  {formatNumber(totalUniqueViews)}
                </div>
              </div>
            </div>

            <h2 style={styles.sectionTitle}>Overall vs Unique Device Views</h2>
            <BarCompare overall={totalViews} unique={totalUniqueViews} />

            <BreakdownTable
              title="Breakdown by Day"
              rows={byDay}
              periodLabel="Date"
            />

            <BreakdownTable
              title="Breakdown by Week"
              rows={byWeek}
              periodLabel="Week"
            />
          </>
        )}

        <Link to="/" style={styles.footerLink}>
          &larr; Back to Create Card
        </Link>
      </div>
    </div>
  );
}