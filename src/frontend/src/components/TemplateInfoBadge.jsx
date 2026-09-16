import { useState, useRef, useEffect, useId } from 'react';

/**
 * TemplateInfoBadge
 *
 * Small reusable component that renders a "premium" badge icon next to a
 * separate info icon. Hovering the info icon on desktop (or tapping it on
 * mobile) reveals a tooltip. On mobile, tapping again toggles it closed,
 * and tapping anywhere outside the component dismisses it.
 *
 * Props:
 *  - tooltipText (string): text shown inside the tooltip
 *      default: "Watch a video to create this one."
 *  - premiumLabel (string): accessible label for the premium badge
 *      default: "Premium template"
 */
export default function TemplateInfoBadge({
  tooltipText = 'Watch a video to create this one.',
  premiumLabel = 'Premium template',
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return undefined;

    function handleOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function handleKey(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const handleInfoClick = (event) => {
    event.stopPropagation();
    setOpen((prev) => !prev);
  };

  const handleMouseEnter = () => setOpen(true);
  const handleMouseLeave = () => setOpen(false);

  return (
    <span
      ref={containerRef}
      style={styles.wrapper}
      className="template-info-badge"
    >
      <span style={styles.premiumBadge} title={premiumLabel} aria-label={premiumLabel}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M12 2L14.5 8.5L21.5 9.3L16.3 13.9L17.8 20.8L12 17.1L6.2 20.8L7.7 13.9L2.5 9.3L9.5 8.5L12 2Z"
            fill="#FFC75F"
            stroke="#2E1F3B"
            strokeWidth="0.75"
            strokeLinejoin="round"
          />
        </svg>
        <span style={styles.premiumText}>Premium</span>
      </span>

      <span
        style={styles.infoIconWrapper}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          type="button"
          onClick={handleInfoClick}
          aria-expanded={open}
          aria-describedby={open ? tooltipId : undefined}
          aria-label="More information"
          style={styles.infoButton}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="#FFFBF5"
              stroke="#FF6F91"
              strokeWidth="1.5"
            />
            <rect x="11" y="10.5" width="2" height="6.5" rx="1" fill="#FF6F91" />
            <circle cx="12" cy="7.5" r="1.2" fill="#FF6F91" />
          </svg>
        </button>

        {open && (
          <span role="tooltip" id={tooltipId} style={styles.tooltip}>
            {tooltipText}
            <span style={styles.tooltipArrow} />
          </span>
        )}
      </span>
    </span>
  );
}

const styles = {
  wrapper: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily:
      "'Poppins', system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  premiumBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '999px',
    background:
      'linear-gradient(135deg, rgba(255,199,95,0.25), rgba(255,111,145,0.2))',
    border: '1px solid #FFC75F',
    color: '#2E1F3B',
  },
  premiumText: {
    fontSize: '11px',
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  },
  infoIconWrapper: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  },
  infoButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    padding: 0,
    background: 'transparent',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    lineHeight: 0,
  },
  tooltip: {
    position: 'absolute',
    bottom: 'calc(100% + 8px)',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#2E1F3B',
    color: '#FFFBF5',
    fontSize: '12px',
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontWeight: 400,
    padding: '8px 12px',
    borderRadius: '8px',
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 12px rgba(46, 31, 59, 0.25)',
    zIndex: 20,
  },
  tooltipArrow: {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: '6px solid #2E1F3B',
  },
};