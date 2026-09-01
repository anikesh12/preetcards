import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import ShareLinkBar from '../components/ShareLinkBar';

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #FFFBF5 0%, #FFF3E4 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px 120px',
    fontFamily: "'Poppins', system-ui, -apple-system, sans-serif",
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    background: '#FFFFFF',
    borderRadius: 24,
    boxShadow: '0 10px 30px rgba(46, 31, 59, 0.12)',
    padding: '40px 28px',
    boxSizing: 'border-box',
  },
  emoji: {
    fontSize: 56,
    lineHeight: 1,
    marginBottom: 12,
  },
  heading: {
    fontFamily: "'Poppins', system-ui, sans-serif",
    fontWeight: 700,
    fontSize: 28,
    color: '#2E1F3B',
    margin: '0 0 8px',
  },
  highlight: {
    color: '#FFC75F',
    textShadow: '1px 1px 0 #2E1F3B, -1px -1px 0 #2E1F3B, 1px -1px 0 #2E1F3B, -1px 1px 0 #2E1F3B',
  },
  subtext: {
    fontSize: 16,
    color: '#5A4A6A',
    margin: '0 0 28px',
    lineHeight: 1.5,
  },
  linkBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#FFFBF5',
    border: '1px solid #F0E4D8',
    borderRadius: 12,
    padding: '10px 14px',
    marginBottom: 20,
  },
  linkInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    color: '#2E1F3B',
    fontSize: 14,
    outline: 'none',
    textOverflow: 'ellipsis',
    minWidth: 0,
  },
  copiedBadge: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: 600,
    marginTop: -12,
    marginBottom: 20,
    height: 16,
  },
  ctaRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  primaryButton: {
    display: 'inline-block',
    width: '100%',
    boxSizing: 'border-box',
    background: '#FF6F91',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: 16,
    border: 'none',
    borderRadius: 14,
    padding: '14px 20px',
    textDecoration: 'none',
    cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(255, 111, 145, 0.35)',
  },
  secondaryLink: {
    display: 'inline-block',
    color: '#2E1F3B',
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    padding: '8px',
  },
  errorHeading: {
    fontSize: 24,
    fontWeight: 700,
    color: '#2E1F3B',
    marginBottom: 8,
  },
  decorTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    overflow: 'hidden',
    lineHeight: 0,
    pointerEvents: 'none',
  },
};

function ConfettiBackdrop() {
  return (
    <svg
      width="100%"
      height="140"
      viewBox="0 0 400 140"
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', opacity: 0.9 }}
      aria-hidden="true"
    >
      <circle cx="30" cy="20" r="5" fill="#FFC75F" />
      <circle cx="80" cy="45" r="4" fill="#FF6F91" />
      <circle cx="140" cy="15" r="6" fill="#FF6F91" />
      <circle cx="200" cy="35" r="4" fill="#FFC75F" />
      <circle cx="260" cy="10" r="5" fill="#FF6F91" />
      <circle cx="320" cy="40" r="6" fill="#FFC75F" />
      <circle cx="370" cy="18" r="4" fill="#FF6F91" />
      <rect x="110" y="60" width="8" height="8" fill="#FFC75F" transform="rotate(25 110 60)" />
      <rect x="230" y="55" width="8" height="8" fill="#FF6F91" transform="rotate(-15 230 55)" />
      <rect x="60" y="70" width="7" height="7" fill="#FF6F91" transform="rotate(45 60 70)" />
      <rect x="300" y="65" width="7" height="7" fill="#FFC75F" transform="rotate(-30 300 65)" />
    </svg>
  );
}

export default function CardCreatedPage() {
  const { cardId: paramCardId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const cardId = paramCardId || location.state?.cardId;
  const recipientName = location.state?.recipientName;

  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (!cardId) return;
    document.title = 'Card Created!';
  }, [cardId]);

  if (!cardId) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.emoji}>🎈</div>
          <h1 style={styles.errorHeading}>Something went wrong</h1>
          <p style={styles.subtext}>
            We couldn't find the card you just created. Let's try making a new one.
          </p>
          <Link to="/" style={styles.primaryButton}>
            Create a Card
          </Link>
        </div>
      </div>
    );
  }

  const cardPath = `/${cardId}`;
  const cardUrl = origin ? `${origin}${cardPath}` : cardPath;

  return (
    <div style={styles.page}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 480 }}>
        <ConfettiBackdrop />
        <div style={styles.card}>
          <div style={styles.emoji}>🎉</div>
          <h1 style={styles.heading}>
            Your Card is <span style={styles.highlight}>Ready!</span>
          </h1>
          <p style={styles.subtext}>
            {recipientName
              ? `Your birthday card for ${recipientName} has been created. Share the link below so they can see it!`
              : 'Your birthday card has been created. Share the link below so the birthday star can see it!'}
          </p>

          <div style={styles.linkBox}>
            <input
              style={styles.linkInput}
              type="text"
              readOnly
              value={cardUrl}
              onFocus={(e) => e.target.select()}
              aria-label="Shareable card link"
            />
          </div>

          <ShareLinkBar
            url={cardUrl}
            title={recipientName ? `Happy Birthday, ${recipientName}!` : 'A birthday card for you!'}
          />

          <div style={{ ...styles.ctaRow, marginTop: 24 }}>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => navigate(cardPath)}
            >
              View Your Card
            </button>
            <Link to="/" style={styles.secondaryLink}>
              Create Another Card
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}