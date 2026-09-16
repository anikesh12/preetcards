import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const styles = {
  page: {
    minHeight: '100vh',
    background: '#FFFBF5',
    fontFamily:
      "'Poppins', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#2E1F3B',
    paddingBottom: '48px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(46,31,59,0.08)',
    background: '#FFFBF5',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    margin: 0,
    color: '#2E1F3B',
  },
  subtitle: {
    fontSize: '13px',
    color: 'rgba(46,31,59,0.6)',
    margin: '2px 0 0',
  },
  logoutBtn: {
    background: 'transparent',
    border: '2px solid #FF6F91',
    color: '#FF6F91',
    borderRadius: '999px',
    padding: '8px 18px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },
  container: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '32px 24px 0',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  toggleGroup: {
    display: 'inline-flex',
    background: '#fff',
    borderRadius: '999px',
    padding: '4px',
    boxShadow: '0 2px 8px rgba(46,31,59,0.08)',
  },
  toggleBtn: (active) => ({
    border: 'none',
    borderRadius: '999px',
    padding: '8px 20px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? '#FF6F91' : 'transparent',
    color: active ? '#fff' : '#2E1F3B',
    transition: 'background 0.15s, color 0.15s',
  }),
  refreshBtn: {
    background: 'transparent',
    border: '1px solid rgba(46,31,59,0.15)',
    color: '#2E1F3B',
    borderRadius: '999px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    marginBottom: '32px',
  },
  statCard: {
    background: '#fff',
    borderRadius: '18px',
    padding: '20px 22px',
    boxShadow: '0 4px 14px rgba(46,31,59,0.08)',
    borderTop: '4px solid #FFC75F',
  },
  statCardCoral: {
    borderTop: '4px solid #FF6F91',
  },
  statLabel: {
    fontSize: '13px',
    color: 'rgba(46,31,59,0.6)',
    margin: 0,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  statValue: {
    fontSize: '36px',
    fontWeight: 700,
    margin: '6px 0 0',
    color: '#2E1F3B',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 700,
    margin: '0 0 16px',
    color: '#2E1F3B',
  },
  panel: {
    background: '#fff',
    borderRadius: '18px',
    padding: '22px',
    boxShadow: '0 4px 14px rgba(46,31,59,0.08)',
    marginBottom: '32px',
  },
  splitRow: {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap',
    marginBottom: '18px',
  },
  splitItem: {
    flex: '1 1 160px',
  },
  splitLabel: {
    fontSize: '13px',
    color: 'rgba(46,31,59,0.6)',
    fontWeight: 600,
  },
  splitValue: {
    fontSize: '24px',
    fontWeight: 700,
    margin: '2px 0 0',
  },
  barTrack: {
    width: '100%',
    height: '14px',
    borderRadius: '999px',
    background: '#FFF1D9',
    overflow: 'hidden',
    display: 'flex',
  },
  barFillOverall: (pct) => ({
    width: `${pct}%`,
    background: '#FF6F91',
    height: '100%',
  }),
  barFillUnique: (pct) => ({
    width: `${pct}%`,
    background: '#FFC75F',
    height: '100%',
  }),
  legendRow: {
    display: 'flex',
    gap: '20px',
    marginTop: '10px',
    fontSize: '13px',
    color: 'rgba(46,31,59,0.7)',
  },
  legendDot: (color) => ({
    display: 'inline-block',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: color,
    marginRight: '6px',
  }),
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'rgba(46,31,59,0.5)',
    padding: '8px 10px',
    borderBottom: '1px solid rgba(46,31,59,0.08)',
  },
  td: {
    padding: '10px 10px',
    fontSize: '14px',
    borderBottom: '1px solid rgba(46,31,59,0.06)',
  },
  emptyState: {
    textAlign: 'center',
    color: 'rgba(46,31,59,0.5)',
    padding: '24px',
    fontSize: '14px',
  },
  skeletonCard: {
    background: '#F1E9DE',
    borderRadius: '18px',
    height: '92px',
  },
  errorBox: {
    background: '#fff',
    border: '1px solid #FF6F91',
    borderRadius: '14px',
    padding: '24px',
    textAlign: 'center',
    color: '#2E1F3B',
  },
  errorBtn: {
    marginTop: '14px',
    background: '#FF6F91',
    color: '#fff',
    border: 'none',
    borderRadius: '999px',
    padding: '10px 22px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  loadingBar: {
    height: '16px',
    background: '#F1E9DE',
    borderRadius: '8px',
    marginBottom: '10px',
  },
  breakdownColumns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '24px',
  },
  breakdownList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  breakdownRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  breakdownRowLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: '#2E1F3B',
  },
  breakdownBarTrack: {
    width: '100%',
    height: '8px',
    borderRadius: '999px',
    background: '#FFF1D9',
    overflow: 'hidden',
  },
  breakdownBarFill: (pct) => ({
    width: `${pct}%`,
    background: '#FF6F91',
    height: '100%',
  }),
  thumbnail: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    objectFit: 'cover',
    display: 'block',
    background: '#FFF1D9',
  },
  thumbnailPlaceholder: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    background: '#FFF1D9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
  },
  paginationRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    marginTop: '16px',
  },
  pageBtn: {
    background: 'transparent',
    border: '1px solid rgba(46,31,59,0.15)',
    color: '#2E1F3B',
    borderRadius: '999px',
    padding: '6px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  pageBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  pageLabel: {
    fontSize: '13px',
    color: 'rgba(46,31,59,0.6)',
  },
};

function getToken() {
  return localStorage.getItem('adminToken');
}

function formatDateTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function clearToken() {
  localStorage.removeItem('adminToken');
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('daily');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const CARDS_PAGE_SIZE = 20;
  const [cardsPage, setCardsPage] = useState(1);
  const [cardsData, setCardsData] = useState(null);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState(null);

  const goToLogin = useCallback(() => {
    clearToken();
    navigate('/admin/login', { replace: true });
  }, [navigate]);

  const fetchStats = useCallback(
    async (selectedPeriod) => {
      setLoading(true);
      setError(null);
      try {
        const token = getToken();
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(
          `${API_BASE}/api/admin/stats?range=${selectedPeriod}`,
          {
            method: 'GET',
            headers,
            credentials: 'include',
          }
        );

        if (res.status === 401) {
          goToLogin();
          return;
        }

        if (!res.ok) {
          throw new Error(`Failed to load stats (${res.status})`);
        }

        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err.message || 'Something went wrong loading stats.');
      } finally {
        setLoading(false);
      }
    },
    [goToLogin]
  );

  useEffect(() => {
    fetchStats(period);
  }, [period, fetchStats]);

  const fetchCards = useCallback(
    async (page) => {
      setCardsLoading(true);
      setCardsError(null);
      try {
        const token = getToken();
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(
          `${API_BASE}/api/admin/cards?page=${page}&limit=${CARDS_PAGE_SIZE}`,
          {
            method: 'GET',
            headers,
            credentials: 'include',
          }
        );

        if (res.status === 401) {
          goToLogin();
          return;
        }

        if (!res.ok) {
          throw new Error(`Failed to load cards (${res.status})`);
        }

        const data = await res.json();
        setCardsData(data);
      } catch (err) {
        setCardsError(err.message || 'Something went wrong loading cards.');
      } finally {
        setCardsLoading(false);
      }
    },
    [goToLogin]
  );

  useEffect(() => {
    fetchCards(cardsPage);
  }, [cardsPage, fetchCards]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const token = getToken();
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      await fetch(`${API_BASE}/api/admin/logout`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
    } catch {
      // ignore network errors on logout; proceed to clear session anyway
    } finally {
      clearToken();
      setLoggingOut(false);
      navigate('/admin/login', { replace: true });
    }
  };

  const totalCards = stats?.totalCards ?? 0;
  const totalViews = stats?.totalViews ?? 0;
  const uniqueViews = stats?.uniqueViews ?? 0;
  const breakdown = Array.isArray(stats?.breakdown) ? stats.breakdown : [];
  const deviceBreakdown = Array.isArray(stats?.deviceBreakdown) ? stats.deviceBreakdown : [];
  const osBreakdown = Array.isArray(stats?.osBreakdown) ? stats.osBreakdown : [];
  const cards = Array.isArray(cardsData?.cards) ? cardsData.cards : [];
  const cardsPagination = cardsData?.pagination || { page: 1, totalPages: 1, total: 0 };
  const deviceTotal = deviceBreakdown.reduce((sum, row) => sum + row.count, 0);
  const osTotal = osBreakdown.reduce((sum, row) => sum + row.count, 0);

  const overallPct =
    totalViews > 0 ? Math.round((totalViews / totalViews) * 100) : 0;
  const uniquePct =
    totalViews > 0 ? Math.round((uniqueViews / totalViews) * 100) : 0;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Admin Dashboard</h1>
          <p style={styles.subtitle}>PreetCards stats at a glance</p>
        </div>
        <button
          type="button"
          style={styles.logoutBtn}
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? 'Logging out...' : 'Log out'}
        </button>
      </header>

      <div style={styles.container}>
        <div style={styles.toggleRow}>
          <div style={styles.toggleGroup} role="group" aria-label="Breakdown period">
            <button
              type="button"
              style={styles.toggleBtn(period === 'daily')}
              onClick={() => setPeriod('daily')}
            >
              Daily
            </button>
            <button
              type="button"
              style={styles.toggleBtn(period === 'weekly')}
              onClick={() => setPeriod('weekly')}
            >
              Weekly
            </button>
          </div>
          <button
            type="button"
            style={styles.refreshBtn}
            onClick={() => fetchStats(period)}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div style={styles.errorBox}>
            <p style={{ margin: 0, fontWeight: 600 }}>Couldn't load dashboard data</p>
            <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'rgba(46,31,59,0.7)' }}>
              {error}
            </p>
            <button
              type="button"
              style={styles.errorBtn}
              onClick={() => fetchStats(period)}
            >
              Try again
            </button>
          </div>
        )}

        {!error && (
          <>
            <div style={styles.statsGrid}>
              {loading && !stats ? (
                <>
                  <div style={styles.skeletonCard} />
                  <div style={styles.skeletonCard} />
                  <div style={styles.skeletonCard} />
                </>
              ) : (
                <>
                  <div style={styles.statCard}>
                    <p style={styles.statLabel}>Total Cards Created</p>
                    <p style={styles.statValue}>{totalCards.toLocaleString()}</p>
                  </div>
                  <div style={{ ...styles.statCard, ...styles.statCardCoral }}>
                    <p style={styles.statLabel}>Total Card Views</p>
                    <p style={styles.statValue}>{totalViews.toLocaleString()}</p>
                  </div>
                  <div style={styles.statCard}>
                    <p style={styles.statLabel}>Unique Device Views</p>
                    <p style={styles.statValue}>{uniqueViews.toLocaleString()}</p>
                  </div>
                </>
              )}
            </div>

            <div style={styles.panel}>
              <h2 style={styles.sectionTitle}>Overall vs Unique-Device Views</h2>
              {loading && !stats ? (
                <>
                  <div style={styles.loadingBar} />
                  <div style={{ ...styles.loadingBar, width: '60%' }} />
                </>
              ) : totalViews === 0 ? (
                <p style={styles.emptyState}>No views recorded yet.</p>
              ) : (
                <>
                  <div style={styles.splitRow}>
                    <div style={styles.splitItem}>
                      <p style={styles.splitLabel}>Overall views</p>
                      <p style={{ ...styles.splitValue, color: '#FF6F91' }}>
                        {totalViews.toLocaleString()}
                      </p>
                    </div>
                    <div style={styles.splitItem}>
                      <p style={styles.splitLabel}>Unique-device views</p>
                      <p style={{ ...styles.splitValue, color: '#C98A00' }}>
                        {uniqueViews.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div style={styles.barTrack}>
                    <div style={styles.barFillOverall(overallPct)} />
                  </div>
                  <div style={styles.barTrack} className="unique-bar">
                    <div style={styles.barFillUnique(uniquePct)} />
                  </div>
                  <div style={styles.legendRow}>
                    <span>
                      <span style={styles.legendDot('#FF6F91')} />
                      Overall ({overallPct}%)
                    </span>
                    <span>
                      <span style={styles.legendDot('#FFC75F')} />
                      Unique devices ({uniquePct}%)
                    </span>
                  </div>
                </>
              )}
            </div>

            <div style={styles.panel}>
              <h2 style={styles.sectionTitle}>
                {period === 'daily' ? 'Daily' : 'Weekly'} Breakdown
              </h2>
              {loading && !stats ? (
                <>
                  <div style={styles.loadingBar} />
                  <div style={styles.loadingBar} />
                  <div style={{ ...styles.loadingBar, width: '80%' }} />
                </>
              ) : breakdown.length === 0 ? (
                <p style={styles.emptyState}>No data for this period yet.</p>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>
                        {period === 'daily' ? 'Date' : 'Week Of'}
                      </th>
                      <th style={styles.th}>Cards Created</th>
                      <th style={styles.th}>Views</th>
                      <th style={styles.th}>Unique Devices</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((row) => (
                      <tr key={row.period || row.date || row.week}>
                        <td style={styles.td}>
                          {row.period || row.date || row.week}
                        </td>
                        <td style={styles.td}>
                          {(row.creates ?? 0).toLocaleString()}
                        </td>
                        <td style={styles.td}>
                          {(row.views ?? 0).toLocaleString()}
                        </td>
                        <td style={styles.td}>
                          {(row.uniqueViews ?? 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={styles.panel}>
              <h2 style={styles.sectionTitle}>Views by Device &amp; OS</h2>
              {loading && !stats ? (
                <>
                  <div style={styles.loadingBar} />
                  <div style={{ ...styles.loadingBar, width: '70%' }} />
                </>
              ) : deviceTotal === 0 && osTotal === 0 ? (
                <p style={styles.emptyState}>No view data yet.</p>
              ) : (
                <div style={styles.breakdownColumns}>
                  <div>
                    <p style={{ ...styles.splitLabel, marginBottom: '10px' }}>Device type</p>
                    <div style={styles.breakdownList}>
                      {deviceBreakdown.map((row) => {
                        const pct = deviceTotal > 0 ? Math.round((row.count / deviceTotal) * 100) : 0;
                        return (
                          <div key={row.label} style={styles.breakdownRow}>
                            <div style={styles.breakdownRowLabel}>
                              <span style={{ textTransform: 'capitalize' }}>{row.label}</span>
                              <span>{row.count.toLocaleString()} ({pct}%)</span>
                            </div>
                            <div style={styles.breakdownBarTrack}>
                              <div style={styles.breakdownBarFill(pct)} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p style={{ ...styles.splitLabel, marginBottom: '10px' }}>Operating system</p>
                    <div style={styles.breakdownList}>
                      {osBreakdown.map((row) => {
                        const pct = osTotal > 0 ? Math.round((row.count / osTotal) * 100) : 0;
                        return (
                          <div key={row.label} style={styles.breakdownRow}>
                            <div style={styles.breakdownRowLabel}>
                              <span>{row.label}</span>
                              <span>{row.count.toLocaleString()} ({pct}%)</span>
                            </div>
                            <div style={styles.breakdownBarTrack}>
                              <div style={styles.breakdownBarFill(pct)} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={styles.panel}>
              <h2 style={styles.sectionTitle}>Cards</h2>
              {cardsError && (
                <div style={styles.errorBox}>
                  <p style={{ margin: 0, fontWeight: 600 }}>Couldn't load cards</p>
                  <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'rgba(46,31,59,0.7)' }}>
                    {cardsError}
                  </p>
                  <button
                    type="button"
                    style={styles.errorBtn}
                    onClick={() => fetchCards(cardsPage)}
                  >
                    Try again
                  </button>
                </div>
              )}
              {!cardsError && cardsLoading && !cardsData ? (
                <>
                  <div style={styles.loadingBar} />
                  <div style={styles.loadingBar} />
                  <div style={{ ...styles.loadingBar, width: '80%' }} />
                </>
              ) : !cardsError && cards.length === 0 ? (
                <p style={styles.emptyState}>No cards created yet.</p>
              ) : !cardsError && (
                <>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}></th>
                        <th style={styles.th}>Recipient</th>
                        <th style={styles.th}>Occasion</th>
                        <th style={styles.th}>Created</th>
                        <th style={styles.th}>Views</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cards.map((card) => (
                        <tr key={card.slug}>
                          <td style={styles.td}>
                            {card.thumbnailUrl ? (
                              <img
                                src={card.thumbnailUrl}
                                alt=""
                                style={styles.thumbnail}
                              />
                            ) : (
                              <div style={styles.thumbnailPlaceholder}>🎉</div>
                            )}
                          </td>
                          <td style={styles.td}>{card.recipientName}</td>
                          <td style={{ ...styles.td, textTransform: 'capitalize' }}>
                            {card.occasion?.replace('_', ' ')}
                          </td>
                          <td style={styles.td}>{formatDateTime(card.createdAt)}</td>
                          <td style={styles.td}>{(card.viewCount ?? 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={styles.paginationRow}>
                    <button
                      type="button"
                      style={{
                        ...styles.pageBtn,
                        ...(cardsPagination.page <= 1 ? styles.pageBtnDisabled : {}),
                      }}
                      onClick={() => setCardsPage((p) => Math.max(1, p - 1))}
                      disabled={cardsPagination.page <= 1 || cardsLoading}
                    >
                      &larr; Prev
                    </button>
                    <span style={styles.pageLabel}>
                      Page {cardsPagination.page} of {cardsPagination.totalPages} ({cardsPagination.total.toLocaleString()} cards)
                    </span>
                    <button
                      type="button"
                      style={{
                        ...styles.pageBtn,
                        ...(cardsPagination.page >= cardsPagination.totalPages ? styles.pageBtnDisabled : {}),
                      }}
                      onClick={() => setCardsPage((p) => Math.min(cardsPagination.totalPages, p + 1))}
                      disabled={cardsPagination.page >= cardsPagination.totalPages || cardsLoading}
                    >
                      Next &rarr;
                    </button>
                  </div>
                </>
              )}
            </div>

            <p style={{ fontSize: '13px', color: 'rgba(46,31,59,0.5)' }}>
              <Link to="/" style={{ color: '#FF6F91', fontWeight: 600 }}>
                &larr; Back to Create Card
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}