import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

const COLORS = {
  coral: '#FF6F91',
  gold: '#FFC75F',
  plum: '#2E1F3B',
  cream: '#FFFBF5',
  errorRed: '#E4572E',
};

const AUTH_STORAGE_KEY = 'admin_auth_header';

function getStoredAuthHeader() {
  try {
    return sessionStorage.getItem(AUTH_STORAGE_KEY) || null;
  } catch (e) {
    return null;
  }
}

function storeAuthHeader(header) {
  try {
    sessionStorage.setItem(AUTH_STORAGE_KEY, header);
  } catch (e) {
    // ignore storage errors (e.g. private browsing)
  }
}

function clearAuthHeader() {
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}

async function fetchStats(authHeader) {
  const res = await fetch('/api/admin/stats', {
    headers: {
      Authorization: authHeader,
    },
  });

  if (res.status === 401) {
    const err = new Error('Invalid username or password.');
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    const err = new Error('Something went wrong loading the dashboard.');
    err.status = res.status;
    throw err;
  }

  return res.json();
}

function formatNumber(n) {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString();
}

function BarChart({ data, keys, colors, labelKey }) {
  if (!data || data.length === 0) {
    return <p style={styles.emptyText}>No data yet.</p>;
  }

  let max = 0;
  data.forEach((row) => {
    keys.forEach((k) => {
      const v = Number(row[k]) || 0;
      if (v > max) max = v;
    });
  });
  if (max === 0) max = 1;

  return (
    <div style={styles.chartWrap}>
      {data.map((row) => (
        <div key={row[labelKey]} style={styles.chartRow}>
          <div style={styles.chartLabel}>{row[labelKey]}</div>
          <div style={styles.chartBars}>
            {keys.map((k, i) => {
              const value = Number(row[k]) || 0;
              const pct = Math.max((value / max) * 100, value > 0 ? 2 : 0);
              return (
                <div key={k} style={styles.chartBarTrack}>
                  <div
                    style={{
                      ...styles.chartBarFill,
                      width: `${pct}%`,
                      background: colors[i],
                    }}
                    title={`${k}: ${value}`}
                  />
                  <span style={styles.chartBarValue}>{formatNumber(value)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{ ...styles.statCard, borderTop: `4px solid ${accent}` }}>
      <div style={styles.statValue}>{formatNumber(value)}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function DataTable({ columns, rows }) {
  if (!rows || rows.length === 0) {
    return <p style={styles.emptyText}>No data yet.</p>;
  }
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={styles.th}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
              {columns.map((col) => (
                <td key={col.key} style={styles.td}>
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [authHeader, setAuthHeader] = useState(null);
  const [checkingStoredAuth, setCheckingStoredAuth] = useState(true);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState('');

  const loadStats = useCallback(async (header) => {
    setLoadingStats(true);
    setStatsError('');
    try {
      const data = await fetchStats(header);
      setStats(data);
    } catch (err) {
      if (err.status === 401) {
        clearAuthHeader();
        setAuthHeader(null);
        setLoginError('Session expired. Please log in again.');
      } else {
        setStatsError(err.message || 'Failed to load dashboard data.');
      }
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    const stored = getStoredAuthHeader();
    if (stored) {
      setAuthHeader(stored);
      loadStats(stored).finally(() => setCheckingStoredAuth(false));
    } else {
      setCheckingStoredAuth(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (!username.trim() || !password) {
      setLoginError('Please enter both username and password.');
      return;
    }

    setLoggingIn(true);
    const header = `Basic ${btoa(`${username}:${password}`)}`;

    try {
      const data = await fetchStats(header);
      storeAuthHeader(header);
      setAuthHeader(header);
      setStats(data);
      setPassword('');
    } catch (err) {
      if (err.status === 401) {
        setLoginError('Invalid username or password.');
      } else {
        setLoginError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clearAuthHeader();
    setAuthHeader(null);
    setStats(null);
    setUsername('');
    setPassword('');
  };

  const handleRefresh = () => {
    if (authHeader) {
      loadStats(authHeader);
    }
  };

  if (checkingStoredAuth) {
    return (
      <div style={styles.page}>
        <div style={styles.centerBox}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Checking session...</p>
        </div>
      </div>
    );
  }

  if (!authHeader) {
    return (
      <div style={styles.page}>
        <div style={styles.loginBox}>
          <h1 style={styles.loginHeading}>Admin Login</h1>
          <p style={styles.loginSubtext}>Sign in to view dashboard analytics.</p>

          <form onSubmit={handleLogin} style={styles.form}>
            <label style={styles.label} htmlFor="admin-username">
              Username
            </label>
            <input
              id="admin-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              autoComplete="username"
              disabled={loggingIn}
            />

            <label style={styles.label} htmlFor="admin-password">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              autoComplete="current-password"
              disabled={loggingIn}
            />

            {loginError && <p style={styles.errorText}>{loginError}</p>}

            <button type="submit" style={styles.primaryButton} disabled={loggingIn}>
              {loggingIn ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <Link to="/" style={styles.backLink}>
            &larr; Back to Create Card
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.dashboardWrap}>
        <header style={styles.dashboardHeader}>
          <div>
            <h1 style={styles.dashboardHeading}>Admin Dashboard</h1>
            <p style={styles.dashboardSubtext}>Card creation and view analytics</p>
          </div>
          <div style={styles.headerActions}>
            <button
              type="button"
              onClick={handleRefresh}
              style={styles.secondaryButton}
              disabled={loadingStats}
            >
              {loadingStats ? 'Refreshing...' : 'Refresh'}
            </button>
            <button type="button" onClick={handleLogout} style={styles.logoutButton}>
              Log Out
            </button>
          </div>
        </header>

        {statsError && (
          <div style={styles.errorBanner}>
            <p style={styles.errorText}>{statsError}</p>
            <button type="button" onClick={handleRefresh} style={styles.secondaryButton}>
              Try Again
            </button>
          </div>
        )}

        {loadingStats && !stats && (
          <div style={styles.centerBox}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Loading dashboard...</p>
          </div>
        )}

        {stats && (
          <>
            <section style={styles.statsGrid}>
              <StatCard
                label="Total Cards Created"
                value={stats.totalCards}
                accent={COLORS.coral}
              />
              <StatCard
                label="Total Views (Lifetime)"
                value={stats.totalViews}
                accent={COLORS.gold}
              />
              <StatCard
                label="Unique Device Views"
                value={stats.uniqueDeviceViews}
                accent={COLORS.plum}
              />
            </section>

            <section style={styles.section}>
              <h2 style={styles.sectionHeading}>Views: Overall vs Unique Devices</h2>
              <div style={styles.legendRow}>
                <span style={styles.legendItem}>
                  <span style={{ ...styles.legendSwatch, background: COLORS.coral }} />
                  Overall views
                </span>
                <span style={styles.legendItem}>
                  <span style={{ ...styles.legendSwatch, background: COLORS.plum }} />
                  Unique device views
                </span>
              </div>
              <BarChart
                data={stats.byDay || []}
                keys={['views', 'uniqueViews']}
                colors={[COLORS.coral, COLORS.plum]}
                labelKey="date"
              />
            </section>

            <section style={styles.section}>
              <h2 style={styles.sectionHeading}>Breakdown by Day</h2>
              <DataTable
                columns={[
                  { key: 'date', label: 'Date' },
                  { key: 'cards', label: 'Cards Created' },
                  { key: 'views', label: 'Total Views' },
                  { key: 'uniqueViews', label: 'Unique Device Views' },
                ]}
                rows={(stats.byDay || []).map((row) => ({
                  date: row.date,
                  cards: formatNumber(row.cards),
                  views: formatNumber(row.views),
                  uniqueViews: formatNumber(row.uniqueViews),
                }))}
              />
            </section>

            <section style={styles.section}>
              <h2 style={styles.sectionHeading}>Breakdown by Week</h2>
              <BarChart
                data={stats.byWeek || []}
                keys={['views', 'uniqueViews']}
                colors={[COLORS.coral, COLORS.plum]}
                labelKey="week"
              />
              <DataTable
                columns={[
                  { key: 'week', label: 'Week' },
                  { key: 'cards', label: 'Cards Created' },
                  { key: 'views', label: 'Total Views' },
                  { key: 'uniqueViews', label: 'Unique Device Views' },
                ]}
                rows={(stats.byWeek || []).map((row) => ({
                  week: row.week,
                  cards: formatNumber(row.cards),
                  views: formatNumber(row.views),
                  uniqueViews: formatNumber(row.uniqueViews),
                }))}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: COLORS.cream,
    fontFamily: "'Poppins', system-ui, -apple-system, sans-serif",
    color: COLORS.plum,
    padding: '24px 16px',
    boxSizing: 'border-box',
  },
  centerBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '40vh',
    gap: '12px',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: `4px solid ${COLORS.gold}`,
    borderTopColor: COLORS.coral,
    borderRadius: '50%',
    animation: 'admin-spin 0.8s linear infinite',
  },
  loadingText: {
    color: COLORS.plum,
    fontSize: '14px',
  },
  loginBox: {
    maxWidth: '380px',
    margin: '10vh auto 0',
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '32px 28px',
    boxShadow: '0 8px 24px rgba(46,31,59,0.12)',
  },
  loginHeading: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 700,
    color: COLORS.plum,
  },
  loginSubtext: {
    marginTop: '6px',
    marginBottom: '20px',
    fontSize: '14px',
    color: '#6B5C74',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: COLORS.plum,
    marginTop: '10px',
  },
  input: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #E5D9E8',
    fontSize: '15px',
    outline: 'none',
    background: COLORS.cream,
    color: COLORS.plum,
  },
  primaryButton: {
    marginTop: '20px',
    padding: '12px 16px',
    borderRadius: '999px',
    border: 'none',
    background: COLORS.coral,
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '15px',
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '8px 14px',
    borderRadius: '999px',
    border: `1px solid ${COLORS.plum}`,
    background: 'transparent',
    color: COLORS.plum,
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
  },
  logoutButton: {
    padding: '8px 14px',
    borderRadius: '999px',
    border: 'none',
    background: COLORS.plum,
    color: '#FFFFFF',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
  },
  errorText: {
    color: COLORS.errorRed,
    fontSize: '13px',
    margin: '8px 0 0',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    background: '#FFF1EC',
    border: `1px solid ${COLORS.errorRed}`,
    borderRadius: '10px',
    padding: '10px 14px',
    marginBottom: '20px',
  },
  backLink: {
    display: 'inline-block',
    marginTop: '18px',
    fontSize: '13px',
    color: COLORS.coral,
    textDecoration: 'none',
    fontWeight: 600,
  },
  dashboardWrap: {
    maxWidth: '960px',
    margin: '0 auto',
  },
  dashboardHeader: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '24px',
  },
  dashboardHeading: {
    margin: 0,
    fontSize: '26px',
    fontWeight: 700,
  },
  dashboardSubtext: {
    margin: '4px 0 0',
    fontSize: '14px',
    color: '#6B5C74',
  },
  headerActions: {
    display: 'flex',
    gap: '10px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '28px',
  },
  statCard: {
    background: '#FFFFFF',
    borderRadius: '14px',
    padding: '18px 16px',
    boxShadow: '0 4px 14px rgba(46,31,59,0.08)',
  },
  statValue: {
    fontSize: '30px',
    fontWeight: 700,
    color: COLORS.plum,
  },
  statLabel: {
    fontSize: '13px',
    color: '#6B5C74',
    marginTop: '4px',
  },
  section: {
    background: '#FFFFFF',
    borderRadius: '14px',
    padding: '18px 20px',
    marginBottom: '22px',
    boxShadow: '0 4px 14px rgba(46,31,59,0.06)',
  },
  sectionHeading: {
    margin: '0 0 12px',
    fontSize: '17px',
    fontWeight: 700,
    color: COLORS.plum,
  },
  legendRow: {
    display: 'flex',
    gap: '18px',
    marginBottom: '14px',
    fontSize: '13px',
    color: '#6B5C74',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  legendSwatch: {
    width: '10px',
    height: '10px',
    borderRadius: '3px',
    display: 'inline-block',
  },
  emptyText: {
    fontSize: '13px',
    color: '#8A7B92',
  },
  chartWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '360px',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  chartRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  chartLabel: {
    width: '90px',
    flexShrink: 0,
    fontSize: '12px',
    color: '#6B5C74',
  },
  chartBars: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  chartBarTrack: {
    position: 'relative',
    background: '#F3ECE0',
    borderRadius: '6px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
  },
  chartBarFill: {
    height: '100%',
    borderRadius: '6px',
    minWidth: '2px',
  },
  chartBarValue: {
    marginLeft: '8px',
    fontSize: '11px',
    color: COLORS.plum,
    whiteSpace: 'nowrap',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    borderBottom: `2px solid ${COLORS.gold}`,
    color: COLORS.plum,
    fontWeight: 700,
  },
  td: {
    padding: '8px 10px',
    color: '#3F3346',
  },
  trEven: {
    background: '#FFFBF5',
  },
  trOdd: {
    background: '#FFFFFF',
  },
};

const styleSheet = typeof document !== 'undefined' ? document.createElement('style') : null;
if (styleSheet) {
  styleSheet.innerHTML = `@keyframes admin-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
  if (!document.getElementById('admin-dashboard-spin-keyframes')) {
    styleSheet.id = 'admin-dashboard-spin-keyframes';
    document.head.appendChild(styleSheet);
  }
}