import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * ShareLinkBar
 *
 * Floating/sticky share control shown on the Card View page.
 * - Primary action copies the shareable card URL to the clipboard and shows a toast.
 * - On devices/browsers that support the Web Share API, an additional "Share" button
 *   triggers the native share sheet.
 *
 * Props:
 *  - url (string, optional): the URL to share. Defaults to window.location.href.
 *  - title (string, optional): title used for native share sheet.
 *  - text (string, optional): text used for native share sheet.
 */
export default function ShareLinkBar({ url, title, text }) {
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const toastTimerRef = useRef(null);
  const copiedTimerRef = useRef(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setCanNativeShare(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const getShareUrl = useCallback(() => {
    if (url && typeof url === 'string' && url.trim().length > 0) {
      return url;
    }
    if (typeof window !== 'undefined') {
      return window.location.href;
    }
    return '';
  }, [url]);

  const triggerToast = useCallback((message) => {
    setToastMessage(message);
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setShowToast(false);
    }, 2200);
  }, []);

  const fallbackCopyToClipboard = useCallback((text) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-1000px';
      textarea.style.left = '-1000px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    } catch (err) {
      return false;
    }
  }, []);

  const handleCopyLink = useCallback(async () => {
    const shareUrl = getShareUrl();

    if (!shareUrl) {
      triggerToast("Couldn't find a link to copy");
      return;
    }

    let success = false;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(shareUrl);
        success = true;
      } else {
        success = fallbackCopyToClipboard(shareUrl);
      }
    } catch (err) {
      success = fallbackCopyToClipboard(shareUrl);
    }

    if (success) {
      setCopied(true);
      triggerToast('Link copied! 🎉');
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2200);
    } else {
      triggerToast("Couldn't copy link — try again");
    }
  }, [getShareUrl, fallbackCopyToClipboard, triggerToast]);

  const handleNativeShare = useCallback(async () => {
    const shareUrl = getShareUrl();

    if (!shareUrl) {
      triggerToast("Couldn't find a link to share");
      return;
    }

    try {
      await navigator.share({
        title: title || 'A card for you!',
        text: text || 'Check out this card 🎉',
        url: shareUrl,
      });
    } catch (err) {
      // User cancelled the share sheet or share failed — no need to surface an error
      // unless it's something unexpected (not an abort).
      if (err && err.name !== 'AbortError') {
        triggerToast("Couldn't open share sheet");
      }
    }
  }, [getShareUrl, title, text, triggerToast]);

  return (
    <div className="share-link-bar" role="region" aria-label="Share this card">
      <style>{`
        .share-link-bar {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 0.75rem;
          padding: 0.85rem 1rem calc(0.85rem + env(safe-area-inset-bottom, 0px));
          background: rgba(255, 251, 245, 0.92);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          border-top: 1px solid rgba(46, 31, 59, 0.08);
          z-index: 50;
          box-sizing: border-box;
        }

        @media (min-width: 768px) {
          .share-link-bar {
            left: auto;
            right: 1.5rem;
            bottom: 1.5rem;
            width: auto;
            padding: 0.5rem;
            background: transparent;
            border-top: none;
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
            justify-content: flex-end;
          }
        }

        .share-link-bar__btn {
          font-family: 'Poppins', system-ui, -apple-system, sans-serif;
          font-weight: 600;
          font-size: 0.95rem;
          border: none;
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.85rem 1.5rem;
          transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
          box-shadow: 0 4px 14px rgba(255, 111, 145, 0.35);
        }

        .share-link-bar__btn:active {
          transform: scale(0.97);
        }

        .share-link-bar__btn--primary {
          background: #FF6F91;
          color: #FFFBF5;
          flex: 1 1 auto;
          max-width: 320px;
        }

        .share-link-bar__btn--primary.is-copied {
          background: #2E1F3B;
        }

        @media (min-width: 768px) {
          .share-link-bar__btn--primary {
            flex: 0 0 auto;
          }
        }

        .share-link-bar__btn--secondary {
          background: #FFC75F;
          color: #2E1F3B;
          box-shadow: 0 4px 14px rgba(255, 199, 95, 0.4);
          flex: 0 0 auto;
        }

        .share-link-bar__icon {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        .share-link-bar__toast {
          position: fixed;
          left: 50%;
          bottom: 5.25rem;
          transform: translateX(-50%) translateY(10px);
          background: #2E1F3B;
          color: #FFFBF5;
          padding: 0.6rem 1.1rem;
          border-radius: 999px;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 0.85rem;
          font-weight: 500;
          box-shadow: 0 6px 18px rgba(46, 31, 59, 0.3);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease, transform 0.2s ease;
          z-index: 60;
          white-space: nowrap;
        }

        .share-link-bar__toast.is-visible {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }

        @media (min-width: 768px) {
          .share-link-bar__toast {
            left: auto;
            right: 1.5rem;
            bottom: 6.25rem;
            transform: translateX(0) translateY(10px);
          }
          .share-link-bar__toast.is-visible {
            transform: translateX(0) translateY(0);
          }
        }
      `}</style>

      <button
        type="button"
        className={`share-link-bar__btn share-link-bar__btn--primary${copied ? ' is-copied' : ''}`}
        onClick={handleCopyLink}
        aria-live="polite"
      >
        <svg
          className="share-link-bar__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {copied ? (
            <polyline points="20 6 9 17 4 12" />
          ) : (
            <>
              <rect x="9" y="9" width="11" height="11" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </>
          )}
        </svg>
        {copied ? 'Copied!' : 'Copy Link'}
      </button>

      {canNativeShare && (
        <button
          type="button"
          className="share-link-bar__btn share-link-bar__btn--secondary"
          onClick={handleNativeShare}
          aria-label="Share via device"
        >
          <svg
            className="share-link-bar__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </button>
      )}

      <div
        className={`share-link-bar__toast${showToast ? ' is-visible' : ''}`}
        role="status"
      >
        {toastMessage}
      </div>
    </div>
  );
}