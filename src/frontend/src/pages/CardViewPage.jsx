import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

const API_BASE = '/api/cards';

function SkeletonGallery() {
  const items = Array.from({ length: 6 });
  return (
    <div className="cv-gallery">
      {items.map((_, i) => (
        <div key={i} className="cv-skeleton cv-skeleton-photo" />
      ))}
    </div>
  );
}

function BalloonIcon() {
  return (
    <svg
      width="140"
      height="140"
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="70" cy="55" rx="38" ry="46" fill="#FF6F91" opacity="0.85" />
      <ellipse cx="70" cy="42" rx="14" ry="10" fill="#fff" opacity="0.25" />
      <line x1="70" y1="101" x2="70" y2="135" stroke="#2E1F3B" strokeWidth="2" />
      <path d="M63 106 Q70 112 77 106" stroke="#2E1F3B" strokeWidth="2" fill="none" />
    </svg>
  );
}

function ConfettiBackground() {
  const dots = [
    { top: '6%', left: '8%', color: '#FFC75F', size: 14, rotate: 12 },
    { top: '14%', left: '85%', color: '#FF6F91', size: 10, rotate: -20 },
    { top: '32%', left: '3%', color: '#2E1F3B', size: 8, rotate: 40 },
    { top: '4%', left: '45%', color: '#FF6F91', size: 12, rotate: -8 },
    { top: '60%', left: '92%', color: '#FFC75F', size: 16, rotate: 20 },
    { top: '78%', left: '5%', color: '#FF6F91', size: 10, rotate: -30 },
    { top: '88%', left: '80%', color: '#FFC75F', size: 12, rotate: 10 },
    { top: '20%', left: '60%', color: '#2E1F3B', size: 8, rotate: -15 },
  ];
  return (
    <div className="cv-confetti" aria-hidden="true">
      {dots.map((d, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: d.top,
            left: d.left,
            width: d.size,
            height: d.size,
            background: d.color,
            borderRadius: i % 2 === 0 ? '3px' : '50%',
            transform: `rotate(${d.rotate}deg)`,
            opacity: 0.55,
          }}
        />
      ))}
    </div>
  );
}

function Toast({ message, show }) {
  return (
    <div className={`cv-toast ${show ? 'cv-toast-show' : ''}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}

function Lightbox({ photos, index, onClose, onPrev, onNext }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onPrev, onNext]);

  if (index === null) return null;
  const photo = photos[index];

  return (
    <div className="cv-lightbox-overlay" onClick={onClose}>
      <button className="cv-lightbox-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      {photos.length > 1 && (
        <button
          className="cv-lightbox-nav cv-lightbox-prev"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          aria-label="Previous photo"
        >
          ‹
        </button>
      )}
      <img
        src={photo.url || photo.thumbnailUrl}
        alt=""
        className="cv-lightbox-img"
        onClick={(e) => e.stopPropagation()}
      />
      {photos.length > 1 && (
        <button
          className="cv-lightbox-nav cv-lightbox-next"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          aria-label="Next photo"
        >
          ›
        </button>
      )}
    </div>
  );
}

export default function CardViewPage() {
  const { id } = useParams();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`${API_BASE}/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setCard(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const showToast = useCallback((message) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  }, []);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const shareData = {
      title: card ? `Happy Birthday, ${card.recipientName}!` : 'Birthday Card',
      text: 'Check out this birthday card!',
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // user cancelled or share failed, fall back to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied!');
    } catch (err) {
      showToast('Could not copy link');
    }
  }, [card, showToast]);

  const openLightbox = (idx) => setLightboxIndex(idx);
  const closeLightbox = () => setLightboxIndex(null);
  const photos = card?.photos || [];
  const prevPhoto = () =>
    setLightboxIndex((i) => (i === 0 ? photos.length - 1 : i - 1));
  const nextPhoto = () =>
    setLightboxIndex((i) => (i === photos.length - 1 ? 0 : i + 1));

  return (
    <div className="cv-page">
      <style>{`
        .cv-page {
          min-height: 100vh;
          background: linear-gradient(180deg, #FFFBF5 0%, #FFF3E2 100%);
          position: relative;
          overflow-x: hidden;
          font-family: system-ui, -apple-system, sans-serif;
          color: #2E1F3B;
          padding-bottom: 96px;
        }
        .cv-confetti {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 480px;
          pointer-events: none;
          z-index: 0;
        }
        .cv-content {
          position: relative;
          z-index: 1;
          max-width: 720px;
          margin: 0 auto;
          padding: 40px 20px 20px;
        }
        .cv-heading {
          font-family: 'Poppins', system-ui, sans-serif;
          font-weight: 700;
          font-size: clamp(2rem, 6vw, 3rem);
          text-align: center;
          color: #FFC75F;
          text-shadow: 2px 2px 0 #2E1F3B, -1px -1px 0 #2E1F3B, 1px -1px 0 #2E1F3B, -1px 1px 0 #2E1F3B;
          margin: 0 0 28px;
          line-height: 1.2;
          word-break: break-word;
        }
        .cv-message-panel {
          background: #FFFDF9;
          border-radius: 20px;
          box-shadow: 0 8px 24px rgba(46, 31, 59, 0.12);
          padding: 28px 24px;
          font-size: 1.05rem;
          line-height: 1.6;
          white-space: pre-wrap;
          word-wrap: break-word;
          margin-bottom: 36px;
          border: 1px solid rgba(255, 111, 145, 0.15);
        }
        .cv-gallery-title {
          font-family: 'Poppins', system-ui, sans-serif;
          font-weight: 600;
          font-size: 1.3rem;
          margin: 0 0 16px;
          color: #2E1F3B;
        }
        .cv-gallery {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        @media (min-width: 640px) {
          .cv-gallery {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (min-width: 900px) {
          .cv-gallery {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        .cv-photo-wrap {
          position: relative;
          border-radius: 14px;
          overflow: hidden;
          aspect-ratio: 1 / 1;
          box-shadow: 0 4px 12px rgba(46, 31, 59, 0.15);
          cursor: pointer;
          border: 3px solid #FFFBF5;
          background: #eee;
        }
        .cv-photo-wrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.25s ease;
        }
        .cv-photo-wrap:hover img {
          transform: scale(1.06);
        }
        .cv-skeleton {
          background: linear-gradient(90deg, #f0e9dd 25%, #f7f1e6 37%, #f0e9dd 63%);
          background-size: 400% 100%;
          animation: cv-shimmer 1.4s ease infinite;
          border-radius: 14px;
        }
        .cv-skeleton-photo {
          aspect-ratio: 1 / 1;
        }
        .cv-skeleton-message {
          height: 120px;
          border-radius: 20px;
          margin-bottom: 36px;
        }
        @keyframes cv-shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        .cv-share-btn {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #FF6F91;
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 14px 24px;
          font-size: 1rem;
          font-weight: 600;
          box-shadow: 0 6px 18px rgba(255, 111, 145, 0.45);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 5;
          transition: transform 0.15s ease;
        }
        .cv-share-btn:hover {
          transform: translateY(-2px);
        }
        @media (max-width: 480px) {
          .cv-share-btn {
            left: 16px;
            right: 16px;
            bottom: 16px;
            width: calc(100% - 32px);
            justify-content: center;
          }
        }
        .cv-toast {
          position: fixed;
          bottom: 90px;
          left: 50%;
          transform: translateX(-50%) translateY(20px);
          background: #2E1F3B;
          color: #FFFBF5;
          padding: 10px 20px;
          border-radius: 999px;
          font-size: 0.9rem;
          opacity: 0;
          transition: opacity 0.25s ease, transform 0.25s ease;
          z-index: 20;
          pointer-events: none;
        }
        .cv-toast-show {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        .cv-footer {
          text-align: center;
          margin-top: 48px;
          font-size: 0.9rem;
          color: #2E1F3B;
          opacity: 0.75;
        }
        .cv-footer a {
          color: #FF6F91;
          font-weight: 600;
          text-decoration: none;
        }
        .cv-footer a:hover {
          text-decoration: underline;
        }
        .cv-error-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 24px;
          background: #FFFBF5;
        }
        .cv-error-heading {
          font-family: 'Poppins', system-ui, sans-serif;
          font-size: 1.8rem;
          font-weight: 700;
          color: #2E1F3B;
          margin: 20px 0 8px;
        }
        .cv-error-sub {
          color: #2E1F3B;
          opacity: 0.7;
          margin-bottom: 24px;
        }
        .cv-create-btn {
          background: #FF6F91;
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 14px 28px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
          box-shadow: 0 6px 18px rgba(255, 111, 145, 0.35);
        }
        .cv-lightbox-overlay {
          position: fixed;
          inset: 0;
          background: rgba(46, 31, 59, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 20px;
        }
        .cv-lightbox-img {
          max-width: 100%;
          max-height: 85vh;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        }
        .cv-lightbox-close {
          position: absolute;
          top: 16px;
          right: 20px;
          background: none;
          border: none;
          color: #FFFBF5;
          font-size: 2.2rem;
          line-height: 1;
          cursor: pointer;
        }
        .cv-lightbox-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(255, 251, 245, 0.15);
          border: none;
          color: #FFFBF5;
          font-size: 2.5rem;
          line-height: 1;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cv-lightbox-prev {
          left: 12px;
        }
        .cv-lightbox-next {
          right: 12px;
        }
      `}</style>

      {error ? (
        <div className="cv-error-page">
          <BalloonIcon />
          <h1 className="cv-error-heading">Card not found</h1>
          <p className="cv-error-sub">
            This card doesn't exist or the link may be incorrect.
          </p>
          <Link to="/" className="cv-create-btn">
            Create a New Card
          </Link>
        </div>
      ) : (
        <>
          <ConfettiBackground />
          <div className="cv-content">
            {loading ? (
              <>
                <div
                  className="cv-skeleton"
                  style={{ height: 48, width: '70%', margin: '0 auto 28px', borderRadius: 12 }}
                />
                <div className="cv-skeleton cv-skeleton-message" />
                <SkeletonGallery />
              </>
            ) : (
              <>
                <h1 className="cv-heading">Happy Birthday, {card.recipientName}!</h1>
                <div className="cv-message-panel">{card.message}</div>
                {photos.length > 0 && (
                  <>
                    <h2 className="cv-gallery-title">Memories</h2>
                    <div className="cv-gallery">
                      {photos.map((photo, idx) => (
                        <div
                          key={photo.id || idx}
                          className="cv-photo-wrap"
                          onClick={() => openLightbox(idx)}
                        >
                          <img
                            src={photo.thumbnailUrl || photo.url}
                            alt={`Photo ${idx + 1} of ${card.recipientName}`}
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="cv-footer">
                  <Link to="/">Create your own card →</Link>
                </div>
              </>
            )}
          </div>

          {!loading && (
            <button className="cv-share-btn" onClick={handleShare}>
              🔗 Share
            </button>
          )}

          <Toast message={toastMessage} show={toastVisible} />

          <Lightbox
            photos={photos}
            index={lightboxIndex}
            onClose={closeLightbox}
            onPrev={prevPhoto}
            onNext={nextPhoto}
          />
        </>
      )}
    </div>
  );
}