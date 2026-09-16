import React, { useCallback, useEffect, useRef, useState } from 'react';

const SCRIPT_ID = 'rewarded-ad-sdk-script';
const AD_LOAD_TIMEOUT_MS = 8000;
const AD_MAX_WAIT_MS = 20000;
const AUTO_CONTINUE_DELAY_MS = 1200;

function loadAdScript(clientId) {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);

    if (existing && existing.dataset.loaded === 'true') {
      resolve();
      return;
    }

    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load ad script')));
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
      clientId
    )}`;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load ad script'));
    document.head.appendChild(script);
  });
}

export default function RewardedAdModal({ adUnitId, adClientId, onComplete, onClose }) {
  const rewardedAdClientId = adClientId;
  const rewardedAdUnitId = adUnitId;
  const [status, setStatus] = useState('loading'); // loading | playing | completed | error
  const [statusText, setStatusText] = useState('Loading your ad…');
  const settledRef = useRef(false);
  const timeoutsRef = useRef([]);

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach((id) => clearTimeout(id));
    timeoutsRef.current = [];
  }, []);

  const complete = useCallback(
    (watchedFully) => {
      if (settledRef.current) return;
      settledRef.current = true;
      clearAllTimeouts();
      setStatus('completed');
      setStatusText(watchedFully ? 'Thanks for watching! Creating your card…' : 'Creating your card…');
      if (typeof onComplete === 'function') {
        onComplete(Boolean(watchedFully));
      }
    },
    [onComplete, clearAllTimeouts]
  );

  const handleCancel = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    clearAllTimeouts();
    if (typeof onClose === 'function') {
      onClose();
    }
  }, [onClose, clearAllTimeouts]);

  useEffect(() => {
    settledRef.current = false;
    let cancelled = false;

    if (!rewardedAdClientId || !rewardedAdUnitId) {
      setStatus('error');
      setStatusText('Ad is not available right now.');
      const t = setTimeout(() => complete(false), AUTO_CONTINUE_DELAY_MS);
      timeoutsRef.current.push(t);
      return () => {
        cancelled = true;
        clearAllTimeouts();
      };
    }

    setStatus('loading');
    setStatusText('Loading your ad…');

    const loadTimeout = setTimeout(() => {
      if (cancelled || settledRef.current) return;
      setStatus('error');
      setStatusText("Ad took too long to load. Skipping ahead.");
      const t = setTimeout(() => complete(false), AUTO_CONTINUE_DELAY_MS);
      timeoutsRef.current.push(t);
    }, AD_LOAD_TIMEOUT_MS);
    timeoutsRef.current.push(loadTimeout);

    loadAdScript(rewardedAdClientId)
      .then(() => {
        if (cancelled || settledRef.current) return;
        clearTimeout(loadTimeout);

        setStatus('playing');
        setStatusText('Playing ad… thanks for your support!');

        try {
          window.adsbygoogle = window.adsbygoogle || [];
          window.adsbygoogle.push({
            type: 'reward',
            name: rewardedAdUnitId,
            google_ad_client: rewardedAdClientId,
            onAdViewed: () => {
              if (cancelled) return;
              complete(true);
            },
            onAdDismissed: () => {
              if (cancelled) return;
              complete(false);
            },
            onAdError: () => {
              if (cancelled) return;
              setStatus('error');
              setStatusText("Couldn't play the ad. Continuing anyway.");
              const t = setTimeout(() => complete(false), AUTO_CONTINUE_DELAY_MS);
              timeoutsRef.current.push(t);
            },
          });

          const maxWaitTimeout = setTimeout(() => {
            if (cancelled || settledRef.current) return;
            complete(false);
          }, AD_MAX_WAIT_MS);
          timeoutsRef.current.push(maxWaitTimeout);
        } catch (err) {
          if (cancelled || settledRef.current) return;
          setStatus('error');
          setStatusText("Couldn't play the ad. Continuing anyway.");
          const t = setTimeout(() => complete(false), AUTO_CONTINUE_DELAY_MS);
          timeoutsRef.current.push(t);
        }
      })
      .catch(() => {
        if (cancelled || settledRef.current) return;
        clearTimeout(loadTimeout);
        setStatus('error');
        setStatusText("Couldn't load the ad. Continuing anyway.");
        const t = setTimeout(() => complete(false), AUTO_CONTINUE_DELAY_MS);
        timeoutsRef.current.push(t);
      });

    return () => {
      cancelled = true;
      clearAllTimeouts();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="ram-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ram-title"
      aria-describedby="ram-text"
    >
      <div className="ram-modal">
        <div className="ram-header">
          <span className="ram-icon" aria-hidden="true">
            {status === 'error' ? '🎈' : '🎉'}
          </span>
          <h2 id="ram-title" className="ram-title">
            {status === 'error' ? 'Ad unavailable' : 'One quick ad first!'}
          </h2>
        </div>

        <div className="ram-body">
          {(status === 'loading' || status === 'playing') && (
            <div className="ram-spinner" aria-hidden="true" />
          )}
          <p id="ram-text" className="ram-text">
            {statusText}
          </p>
        </div>

        <div className="ram-footer">
          <button
            type="button"
            className="ram-cancel-btn"
            onClick={handleCancel}
            disabled={status === 'completed'}
          >
            Cancel
          </button>
        </div>
      </div>

      <style>{`
        .ram-overlay {
          position: fixed;
          inset: 0;
          background: rgba(46, 31, 59, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 1000;
          animation: ram-fade-in 0.18s ease-out;
        }

        .ram-modal {
          width: 100%;
          max-width: 360px;
          background: #FFFBF5;
          border-radius: 20px;
          box-shadow: 0 18px 40px rgba(46, 31, 59, 0.35);
          padding: 28px 24px 20px;
          text-align: center;
          font-family: 'Poppins', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
          animation: ram-pop-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .ram-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }

        .ram-icon {
          font-size: 36px;
          line-height: 1;
        }

        .ram-title {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: #2E1F3B;
        }

        .ram-body {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 88px;
          gap: 14px;
          margin-bottom: 20px;
        }

        .ram-text {
          margin: 0;
          font-size: 15px;
          color: #2E1F3B;
          opacity: 0.85;
          max-width: 280px;
        }

        .ram-spinner {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 4px solid rgba(255, 199, 95, 0.35);
          border-top-color: #FF6F91;
          animation: ram-spin 0.8s linear infinite;
        }

        .ram-footer {
          display: flex;
          justify-content: center;
        }

        .ram-cancel-btn {
          appearance: none;
          border: 2px solid #FF6F91;
          background: transparent;
          color: #FF6F91;
          font-family: inherit;
          font-weight: 600;
          font-size: 14px;
          padding: 10px 24px;
          border-radius: 999px;
          cursor: pointer;
          transition: background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
        }

        .ram-cancel-btn:hover:not(:disabled) {
          background-color: #FF6F91;
          color: #FFFBF5;
        }

        .ram-cancel-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        @keyframes ram-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes ram-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes ram-pop-in {
          from {
            opacity: 0;
            transform: scale(0.92) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @media (max-width: 420px) {
          .ram-modal {
            border-radius: 20px 20px 0 0;
            max-width: 100%;
          }

          .ram-overlay {
            align-items: flex-end;
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
}