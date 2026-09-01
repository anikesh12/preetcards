import { useEffect, useRef, useState, useCallback } from 'react';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ACCEPTED_EXT_HINT = 'JPG, PNG, WEBP or GIF';

const COLORS = {
  coral: '#FF6F91',
  gold: '#FFC75F',
  plum: '#2E1F3B',
  cream: '#FFFBF5',
  error: '#E4572E',
  border: '#EBDFE9',
  mutedText: '#8A7A94',
};

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    fontFamily: "'Poppins', system-ui, -apple-system, sans-serif",
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: COLORS.plum,
  },
  dropzone: (isDragging, isDisabled) => ({
    border: `2px dashed ${isDragging ? COLORS.coral : COLORS.border}`,
    borderRadius: '16px',
    background: isDragging ? '#FFF1F4' : '#FFFDF9',
    padding: '24px 16px',
    textAlign: 'center',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.6 : 1,
    transition: 'all 0.15s ease',
  }),
  dropzoneIcon: {
    fontSize: '28px',
    marginBottom: '6px',
  },
  dropzoneText: {
    fontSize: '14px',
    fontWeight: 600,
    color: COLORS.plum,
    margin: 0,
  },
  dropzoneHint: {
    fontSize: '12px',
    color: COLORS.mutedText,
    marginTop: '4px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
    gap: '10px',
  },
  thumbWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1 / 1',
    borderRadius: '12px',
    overflow: 'hidden',
    border: `1px solid ${COLORS.border}`,
    background: '#f4f0f6',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  removeBtn: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(46, 31, 59, 0.75)',
    color: '#fff',
    fontSize: '13px',
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  addTile: (isDisabled) => ({
    width: '100%',
    aspectRatio: '1 / 1',
    borderRadius: '12px',
    border: `2px dashed ${COLORS.border}`,
    background: '#FFFDF9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '26px',
    color: COLORS.coral,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
  }),
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countText: {
    fontSize: '12px',
    color: COLORS.mutedText,
  },
  hint: {
    fontSize: '12px',
    color: COLORS.mutedText,
  },
  errorList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  errorItem: {
    fontSize: '12px',
    color: COLORS.error,
    fontWeight: 500,
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0,0,0,0)',
    whiteSpace: 'nowrap',
    border: 0,
  },
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Reusable photo upload input with drag-and-drop, click-to-browse,
 * client-side type/size validation, max photo count enforcement,
 * thumbnail previews and per-photo removal.
 *
 * Controlled component: `photos` is an array of File objects (or string
 * URLs for already-uploaded images) owned by the parent; changes are
 * reported via `onChange(nextPhotosArray)`.
 */
export default function PhotoUploadInput({
  photos = [],
  onChange,
  maxPhotos = 6,
  maxSizeMB = 5,
  disabled = false,
  label = 'Photos',
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState([]);
  const [previews, setPreviews] = useState([]);
  const inputRef = useRef(null);
  const dragCounter = useRef(0);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  const remainingSlots = Math.max(0, maxPhotos - photos.length);
  const isFull = remainingSlots <= 0;
  const isDisabled = disabled || isFull;

  // Build/revoke object URLs for File previews.
  useEffect(() => {
    const urls = photos.map((item) =>
      typeof item === 'string' ? item : URL.createObjectURL(item)
    );
    setPreviews(urls);
    return () => {
      urls.forEach((url, i) => {
        if (typeof photos[i] !== 'string') URL.revokeObjectURL(url);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  const validateAndAdd = useCallback(
    (fileList) => {
      if (disabled) return;

      const incoming = Array.from(fileList || []);
      if (incoming.length === 0) return;

      const newErrors = [];
      let validFiles = [];

      incoming.forEach((file) => {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          newErrors.push(`"${file.name}" isn't a supported image type.`);
          return;
        }
        if (file.size > maxSizeBytes) {
          newErrors.push(`"${file.name}" is larger than ${maxSizeMB}MB.`);
          return;
        }
        validFiles.push(file);
      });

      const spaceLeft = Math.max(0, maxPhotos - photos.length);
      if (validFiles.length > spaceLeft) {
        const dropped = validFiles.length - spaceLeft;
        if (spaceLeft === 0) {
          newErrors.push(`You can only add up to ${maxPhotos} photos.`);
        } else {
          newErrors.push(
            `Only ${spaceLeft} more photo${spaceLeft === 1 ? '' : 's'} allowed — ${dropped} photo${
              dropped === 1 ? '' : 's'
            } skipped.`
          );
        }
        validFiles = validFiles.slice(0, spaceLeft);
      }

      setErrors(newErrors);

      if (validFiles.length > 0 && typeof onChange === 'function') {
        onChange([...photos, ...validFiles]);
      }
    },
    [disabled, maxPhotos, maxSizeBytes, maxSizeMB, onChange, photos]
  );

  const handleInputChange = (e) => {
    validateAndAdd(e.target.files);
    e.target.value = '';
  };

  const openFileDialog = () => {
    if (isDisabled) return;
    inputRef.current?.click();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    if (isDisabled) return;
    validateAndAdd(e.dataTransfer.files);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDisabled) return;
    dragCounter.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleRemove = (index) => {
    if (typeof onChange !== 'function') return;
    const next = photos.filter((_, i) => i !== index);
    setErrors([]);
    onChange(next);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFileDialog();
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.metaRow}>
        <label style={styles.label}>{label}</label>
        <span style={styles.countText}>
          {photos.length}/{maxPhotos} photos
        </span>
      </div>

      {photos.length > 0 && (
        <div style={styles.grid}>
          {photos.map((file, index) => (
            <div key={`${index}-${typeof file === 'string' ? file : file.name}`} style={styles.thumbWrap}>
              <img
                src={previews[index]}
                alt={`Upload preview ${index + 1}`}
                style={styles.thumbImg}
              />
              <button
                type="button"
                style={styles.removeBtn}
                onClick={() => handleRemove(index)}
                aria-label={`Remove photo ${index + 1}`}
                title="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
          {!isFull && (
            <div
              role="button"
              tabIndex={0}
              style={styles.addTile(disabled)}
              onClick={openFileDialog}
              onKeyDown={handleKeyDown}
              aria-label="Add more photos"
              title="Add more photos"
            >
              +
            </div>
          )}
        </div>
      )}

      {photos.length === 0 && (
        <div
          role="button"
          tabIndex={0}
          style={styles.dropzone(isDragging, disabled)}
          onClick={openFileDialog}
          onKeyDown={handleKeyDown}
          onDrop={handleDrop}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          aria-label="Upload photos"
        >
          <div style={styles.dropzoneIcon} aria-hidden="true">
            📸
          </div>
          <p style={styles.dropzoneText}>Tap to upload or drag photos here</p>
          <p style={styles.dropzoneHint}>
            {ACCEPTED_EXT_HINT} · up to {maxSizeMB}MB each · max {maxPhotos} photos
          </p>
        </div>
      )}

      {photos.length > 0 && (
        <p style={styles.hint}>
          {ACCEPTED_EXT_HINT} · up to {maxSizeMB}MB each
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        onChange={handleInputChange}
        style={styles.srOnly}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
      />

      {errors.length > 0 && (
        <ul style={styles.errorList}>
          {errors.map((msg, i) => (
            <li key={i} style={styles.errorItem}>
              {msg}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}