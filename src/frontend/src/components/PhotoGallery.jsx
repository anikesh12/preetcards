import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * PhotoGallery
 * Renders an adaptive photo grid/collage that changes layout based on photo count,
 * with a tap-to-enlarge lightbox modal (supports keyboard nav + touch swipe).
 *
 * Props:
 *  - photos: Array<{ id?: string|number, url: string, thumbnailUrl?: string, alt?: string }>
 *            (also accepts an array of plain string URLs)
 */
export default function PhotoGallery({ photos = [] }) {
  const normalized = normalizePhotos(photos);
  const [activeIndex, setActiveIndex] = useState(null);
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);

  const isOpen = activeIndex !== null;

  const openAt = useCallback((index) => setActiveIndex(index), []);
  const close = useCallback(() => setActiveIndex(null), []);

  const showPrev = useCallback(() => {
    setActiveIndex((prev) =>
      prev === null ? null : (prev - 1 + normalized.length) % normalized.length
    );
  }, [normalized.length]);

  const showNext = useCallback(() => {
    setActiveIndex((prev) =>
      prev === null ? null : (prev + 1) % normalized.length
    );
  }, [normalized.length]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') showPrev();
      else if (e.key === 'ArrowRight') showNext();
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, close, showPrev, showNext]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const delta = touchStartX.current - touchEndX.current;
    const SWIPE_THRESHOLD = 40;
    if (delta > SWIPE_THRESHOLD) showNext();
    else if (delta < -SWIPE_THRESHOLD) showPrev();
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (!normalized.length) return null;

  const layoutClass = getLayoutClass(normalized.length);

  return (
    <div className="pg-wrapper">
      <style>{PHOTO_GALLERY_STYLES}</style>

      <div className={`pg-grid ${layoutClass}`}>
        {normalized.map((photo, index) => (
          <button
            key={photo.id ?? index}
            type="button"
            className="pg-item"
            onClick={() => openAt(index)}
            aria-label={`View photo ${index + 1} of ${normalized.length}${
              photo.alt ? `: ${photo.alt}` : ''
            }`}
          >
            <img
              src={photo.thumbnailUrl || photo.url}
              alt={photo.alt || `Photo ${index + 1}`}
              loading="lazy"
              className="pg-img"
            />
          </button>
        ))}
      </div>

      {isOpen && (
        <div
          className="pg-lightbox-backdrop"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
        >
          <div
            className="pg-lightbox-content"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <button
              type="button"
              className="pg-close-btn"
              onClick={close}
              aria-label="Close photo viewer"
            >
              ✕
            </button>

            {normalized.length > 1 && (
              <button
                type="button"
                className="pg-nav-btn pg-nav-prev"
                onClick={showPrev}
                aria-label="Previous photo"
              >
                ‹
              </button>
            )}

            <img
              src={normalized[activeIndex].url}
              alt={normalized[activeIndex].alt || `Photo ${activeIndex + 1}`}
              className="pg-lightbox-img"
            />

            {normalized.length > 1 && (
              <button
                type="button"
                className="pg-nav-btn pg-nav-next"
                onClick={showNext}
                aria-label="Next photo"
              >
                ›
              </button>
            )}

            {normalized.length > 1 && (
              <div className="pg-counter">
                {activeIndex + 1} / {normalized.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function normalizePhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos
    .filter(Boolean)
    .map((p) => (typeof p === 'string' ? { url: p } : p))
    .filter((p) => p && p.url);
}

function getLayoutClass(count) {
  if (count === 1) return 'pg-layout-1';
  if (count === 2) return 'pg-layout-2';
  if (count === 3) return 'pg-layout-3';
  if (count === 4) return 'pg-layout-4';
  return 'pg-layout-many';
}

const PHOTO_GALLERY_STYLES = `
.pg-wrapper {
  width: 100%;
  margin: 0 auto;
}

.pg-grid {
  display: grid;
  gap: 10px;
  width: 100%;
}

/* 1 photo: single large image */
.pg-layout-1 {
  grid-template-columns: 1fr;
}
.pg-layout-1 .pg-item {
  aspect-ratio: 4 / 3;
}

/* 2 photos: side by side */
.pg-layout-2 {
  grid-template-columns: 1fr 1fr;
}
.pg-layout-2 .pg-item {
  aspect-ratio: 1 / 1;
}

/* 3 photos: one large + two stacked */
.pg-layout-3 {
  grid-template-columns: 2fr 1fr;
  grid-template-rows: 1fr 1fr;
}
.pg-layout-3 .pg-item:nth-child(1) {
  grid-row: 1 / 3;
}
.pg-layout-3 .pg-item {
  aspect-ratio: unset;
}
.pg-layout-3 .pg-item:nth-child(1) {
  min-height: 100%;
}

/* 4 photos: even 2x2 grid */
.pg-layout-4 {
  grid-template-columns: 1fr 1fr;
}
.pg-layout-4 .pg-item {
  aspect-ratio: 1 / 1;
}

/* 5+ photos: responsive uniform grid, 2 cols mobile */
.pg-layout-many {
  grid-template-columns: repeat(2, 1fr);
}
.pg-layout-many .pg-item {
  aspect-ratio: 1 / 1;
}

@media (min-width: 640px) {
  .pg-layout-many {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 960px) {
  .pg-layout-many {
    grid-template-columns: repeat(4, 1fr);
  }
}

.pg-item {
  position: relative;
  padding: 0;
  border: none;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  background: #FFF1E6;
  display: block;
  width: 100%;
  height: 100%;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.pg-item:hover,
.pg-item:focus-visible {
  transform: scale(1.02);
  box-shadow: 0 6px 18px rgba(46, 31, 59, 0.18);
  outline: 2px solid #FFC75F;
  outline-offset: 2px;
}

.pg-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Lightbox */
.pg-lightbox-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(46, 31, 59, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
  animation: pg-fade-in 0.15s ease;
}

@keyframes pg-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.pg-lightbox-content {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pg-lightbox-img {
  max-width: 92vw;
  max-height: 86vh;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
}

.pg-close-btn {
  position: absolute;
  top: -44px;
  right: 0;
  background: #FFC75F;
  color: #2E1F3B;
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.pg-nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 251, 245, 0.9);
  color: #2E1F3B;
  border: none;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.pg-nav-btn:hover {
  background: #FF6F91;
  color: #FFFBF5;
}

.pg-nav-prev {
  left: -8px;
}

.pg-nav-next {
  right: -8px;
}

@media (max-width: 640px) {
  .pg-nav-prev {
    left: 4px;
  }
  .pg-nav-next {
    right: 4px;
  }
  .pg-close-btn {
    top: -40px;
    right: 0;
  }
}

.pg-counter {
  position: absolute;
  bottom: -34px;
  left: 50%;
  transform: translateX(-50%);
  color: #FFFBF5;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
  background: rgba(46, 31, 59, 0.6);
  padding: 4px 12px;
  border-radius: 999px;
}
`;