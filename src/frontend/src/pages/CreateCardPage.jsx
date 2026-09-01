import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const MAX_PHOTOS = 6;
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_MESSAGE_LENGTH = 500;

export default function CreateCardPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [photos, setPhotos] = useState([]); // { file, previewUrl, id }
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const validateField = (field, value, currentPhotos) => {
    const fieldErrors = {};

    if (field === 'recipientName' || field === 'all') {
      if (!value?.recipientName?.trim() && field === 'all') {
        fieldErrors.recipientName = 'Recipient name is required';
      } else if (field === 'recipientName' && !value.trim()) {
        fieldErrors.recipientName = 'Recipient name is required';
      }
    }

    return fieldErrors;
  };

  const validateForm = () => {
    const newErrors = {};

    if (!recipientName.trim()) {
      newErrors.recipientName = 'Recipient name is required';
    } else if (recipientName.trim().length > 100) {
      newErrors.recipientName = 'Name is too long (max 100 characters)';
    }

    if (!message.trim()) {
      newErrors.message = 'A birthday message is required';
    } else if (message.length > MAX_MESSAGE_LENGTH) {
      newErrors.message = `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`;
    }

    if (photos.length > MAX_PHOTOS) {
      newErrors.photos = `You can upload up to ${MAX_PHOTOS} photos`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addFiles = useCallback((fileList) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    setErrors((prev) => ({ ...prev, photos: undefined }));

    setPhotos((prevPhotos) => {
      let updated = [...prevPhotos];
      let photoError = '';

      for (const file of incoming) {
        if (updated.length >= MAX_PHOTOS) {
          photoError = `You can upload up to ${MAX_PHOTOS} photos`;
          break;
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
          photoError = `"${file.name}" is not a supported image type`;
          continue;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          photoError = `"${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB size limit`;
          continue;
        }

        updated.push({
          file,
          previewUrl: URL.createObjectURL(file),
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        });
      }

      if (photoError) {
        setErrors((prev) => ({ ...prev, photos: photoError }));
      }

      return updated;
    });
  }, []);

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removePhoto = (id) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('recipientName', recipientName.trim());
      formData.append('message', message.trim());
      photos.forEach((p) => {
        formData.append('photos', p.file);
      });

      const response = await fetch('/api/cards', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errMsg = 'Something went wrong creating your card. Please try again.';
        try {
          const data = await response.json();
          if (data?.error) errMsg = data.error;
        } catch {
          // ignore parse errors
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      const cardId = data.id || data.cardId || data.slug;

      if (!cardId) {
        throw new Error('Card was created but no ID was returned.');
      }

      navigate(`/card/${cardId}`);
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  const messageCount = message.length;

  return (
    <div style={styles.page}>
      <style>{`
        .cc-photo-drop:hover {
          border-color: #FF6F91;
          background-color: #FFF3F6;
        }
        .cc-submit-btn:hover:not(:disabled) {
          background-color: #FF5C82;
        }
        .cc-remove-btn:hover {
          background-color: #2E1F3B;
        }
        .cc-input:focus, .cc-textarea:focus {
          outline: none;
          border-color: #FF6F91;
          box-shadow: 0 0 0 3px rgba(255, 111, 145, 0.15);
        }
        @keyframes cc-spin {
          to { transform: rotate(360deg); }
        }
        .cc-spinner {
          animation: cc-spin 0.7s linear infinite;
        }
      `}</style>

      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.logoRow}>
            <span style={styles.logoEmoji} aria-hidden="true">🎂</span>
            <h1 style={styles.logoText}>Birthday Wishes</h1>
          </div>
          <p style={styles.tagline}>Make someone's birthday special</p>
        </header>

        <form onSubmit={handleSubmit} noValidate style={styles.form}>
          <div style={styles.field}>
            <label htmlFor="recipientName" style={styles.label}>
              Recipient Name <span style={styles.required}>*</span>
            </label>
            <input
              id="recipientName"
              type="text"
              className="cc-input"
              style={{
                ...styles.input,
                ...(errors.recipientName ? styles.inputError : {}),
              }}
              value={recipientName}
              onChange={(e) => {
                setRecipientName(e.target.value);
                if (errors.recipientName) {
                  setErrors((prev) => ({ ...prev, recipientName: undefined }));
                }
              }}
              placeholder="e.g. Priya"
              maxLength={100}
              disabled={submitting}
            />
            {errors.recipientName && (
              <p style={styles.errorText}>{errors.recipientName}</p>
            )}
          </div>

          <div style={styles.field}>
            <div style={styles.labelRow}>
              <label htmlFor="message" style={styles.label}>
                Birthday Message <span style={styles.required}>*</span>
              </label>
              <span
                style={{
                  ...styles.charCounter,
                  ...(messageCount > MAX_MESSAGE_LENGTH ? styles.charCounterOver : {}),
                }}
              >
                {messageCount}/{MAX_MESSAGE_LENGTH}
              </span>
            </div>
            <textarea
              id="message"
              className="cc-textarea"
              style={{
                ...styles.textarea,
                ...(errors.message ? styles.inputError : {}),
              }}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (errors.message) {
                  setErrors((prev) => ({ ...prev, message: undefined }));
                }
              }}
              placeholder="Write a warm birthday message..."
              rows={6}
              disabled={submitting}
            />
            {errors.message && <p style={styles.errorText}>{errors.message}</p>}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>
              Photos{' '}
              <span style={styles.hint}>
                (up to {MAX_PHOTOS}, max {MAX_FILE_SIZE_MB}MB each — JPG, PNG, WEBP, GIF)
              </span>
            </label>

            <div
              className="cc-photo-drop"
              style={{
                ...styles.dropZone,
                ...(isDragging ? styles.dropZoneActive : {}),
              }}
              onClick={() => !submitting && fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              role="button"
              tabIndex={0}
              aria-label="Upload photos"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_TYPES.join(',')}
                multiple
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
                disabled={submitting}
              />
              <span style={styles.dropZoneIcon} aria-hidden="true">📷</span>
              <p style={styles.dropZoneText}>
                Tap or drag photos here ({photos.length}/{MAX_PHOTOS})
              </p>
            </div>

            {errors.photos && <p style={styles.errorText}>{errors.photos}</p>}

            {photos.length > 0 && (
              <div style={styles.thumbGrid}>
                {photos.map((p) => (
                  <div key={p.id} style={styles.thumbWrapper}>
                    <img src={p.previewUrl} alt="" style={styles.thumbImg} />
                    <button
                      type="button"
                      className="cc-remove-btn"
                      style={styles.removeBtn}
                      onClick={() => removePhoto(p.id)}
                      disabled={submitting}
                      aria-label="Remove photo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {submitError && (
            <div style={styles.submitErrorBox} role="alert">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            className="cc-submit-btn"
            style={{
              ...styles.submitBtn,
              ...(submitting ? styles.submitBtnDisabled : {}),
            }}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="cc-spinner" style={styles.spinner} aria-hidden="true" />
                Creating...
              </>
            ) : (
              'Create Card'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#FFFBF5',
    fontFamily:
      "'Poppins', system-ui, -apple-system, 'Segoe UI', sans-serif",
    padding: '24px 16px 48px',
    boxSizing: 'border-box',
  },
  container: {
    maxWidth: '480px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  logoEmoji: {
    fontSize: '28px',
  },
  logoText: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#2E1F3B',
    margin: 0,
  },
  tagline: {
    fontSize: '14px',
    color: '#6B5B73',
    marginTop: '6px',
    marginBottom: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#2E1F3B',
    marginBottom: '6px',
  },
  hint: {
    fontWeight: 400,
    color: '#8A7A91',
    fontSize: '12px',
  },
  required: {
    color: '#FF6F91',
  },
  charCounter: {
    fontSize: '12px',
    color: '#8A7A91',
  },
  charCounterOver: {
    color: '#E24E5A',
    fontWeight: 600,
  },
  input: {
    fontSize: '16px',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '2px solid #EEE0E4',
    backgroundColor: '#FFFFFF',
    color: '#2E1F3B',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  textarea: {
    fontSize: '16px',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '2px solid #EEE0E4',
    backgroundColor: '#FFFFFF',
    color: '#2E1F3B',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: '120px',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  inputError: {
    borderColor: '#E24E5A',
  },
  errorText: {
    color: '#E24E5A',
    fontSize: '13px',
    marginTop: '6px',
    marginBottom: 0,
  },
  dropZone: {
    border: '2px dashed #E8D5DB',
    borderRadius: '16px',
    padding: '24px 16px',
    textAlign: 'center',
    cursor: 'pointer',
    backgroundColor: '#FFF9F5',
    transition: 'border-color 0.15s, background-color 0.15s',
  },
  dropZoneActive: {
    borderColor: '#FF6F91',
    backgroundColor: '#FFF3F6',
  },
  dropZoneIcon: {
    fontSize: '28px',
    display: 'block',
    marginBottom: '6px',
  },
  dropZoneText: {
    fontSize: '13px',
    color: '#6B5B73',
    margin: 0,
  },
  thumbGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    marginTop: '12px',
  },
  thumbWrapper: {
    position: 'relative',
    width: '100%',
    paddingBottom: '100%',
    borderRadius: '12px',
    overflow: 'hidden',
    backgroundColor: '#F1E6EA',
  },
  thumbImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  removeBtn: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'rgba(46, 31, 59, 0.75)',
    color: '#FFFFFF',
    fontSize: '15px',
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.15s',
  },
  submitErrorBox: {
    backgroundColor: '#FDECEA',
    color: '#B3261E',
    padding: '12px 14px',
    borderRadius: '10px',
    fontSize: '14px',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    backgroundColor: '#FF6F91',
    color: '#FFFFFF',
    fontSize: '16px',
    fontWeight: 700,
    padding: '14px 20px',
    borderRadius: '14px',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'background-color 0.15s',
  },
  submitBtnDisabled: {
    backgroundColor: '#FFB3C4',
    cursor: 'not-allowed',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.5)',
    borderTopColor: '#FFFFFF',
    borderRadius: '50%',
    display: 'inline-block',
  },
};