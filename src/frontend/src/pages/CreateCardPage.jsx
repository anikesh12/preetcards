import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const MAX_PHOTOS = 6;
const MAX_MESSAGE_LENGTH = 500;
const MAX_FILE_SIZE_MB = 8;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function CreateCardPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [photos, setPhotos] = useState([]); // { file, previewUrl }
  const [errors, setErrors] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const validate = useCallback(() => {
    const nextErrors = {};

    if (!recipientName.trim()) {
      nextErrors.recipientName = 'Recipient name is required.';
    }

    if (!message.trim()) {
      nextErrors.message = 'Birthday message is required.';
    } else if (message.length > MAX_MESSAGE_LENGTH) {
      nextErrors.message = `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`;
    }

    if (photos.length > MAX_PHOTOS) {
      nextErrors.photos = `You can upload up to ${MAX_PHOTOS} photos.`;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [recipientName, message, photos]);

  const addFiles = useCallback(
    (fileList) => {
      const incoming = Array.from(fileList);
      let rejectionMessage = '';

      const validFiles = incoming.filter((file) => {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          rejectionMessage = 'Only JPG, PNG, WEBP, or GIF images are supported.';
          return false;
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          rejectionMessage = `Each photo must be under ${MAX_FILE_SIZE_MB}MB.`;
          return false;
        }
        return true;
      });

      setPhotos((prev) => {
        const combined = [...prev, ...validFiles.map((file) => ({
          file,
          previewUrl: URL.createObjectURL(file),
        }))];

        if (combined.length > MAX_PHOTOS) {
          rejectionMessage = `You can upload up to ${MAX_PHOTOS} photos.`;
          return combined.slice(0, MAX_PHOTOS);
        }
        return combined;
      });

      if (rejectionMessage) {
        setErrors((prev) => ({ ...prev, photos: rejectionMessage }));
      } else {
        setErrors((prev) => ({ ...prev, photos: undefined }));
      }
    },
    []
  );

  const handleFileInputChange = (event) => {
    if (event.target.files && event.target.files.length) {
      addFiles(event.target.files);
    }
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length) {
      addFiles(event.dataTransfer.files);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const removePhoto = (index) => {
    setPhotos((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('recipientName', recipientName.trim());
      formData.append('message', message.trim());
      photos.forEach(({ file }) => {
        formData.append('photos', file);
      });

      const response = await fetch('/api/cards', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || 'Something went wrong creating your card.');
      }

      const data = await response.json();
      const cardId = data.id || data.cardId;
      const shareUrl = data.shareUrl || data.share_link || (cardId ? `${window.location.origin}/card/${cardId}` : '');

      if (!cardId) {
        throw new Error('Card was created but no id was returned.');
      }

      navigate(`/card/${cardId}/created`, {
        state: { cardId, shareUrl, recipientName: recipientName.trim() },
      });
    } catch (error) {
      setSubmitError(error.message || 'Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  const remainingChars = MAX_MESSAGE_LENGTH - message.length;

  return (
    <div className="create-card-page">
      <style>{`
        .create-card-page {
          min-height: 100vh;
          background: linear-gradient(180deg, #FFFBF5 0%, #FFF3E2 100%);
          font-family: system-ui, -apple-system, sans-serif;
          color: #2E1F3B;
          padding: 40px 20px 64px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .create-card-header {
          text-align: center;
          margin-bottom: 28px;
        }

        .app-logo {
          font-family: 'Poppins', system-ui, sans-serif;
          font-weight: 700;
          font-size: clamp(1.6rem, 6vw, 2.2rem);
          color: #FFC75F;
          text-shadow: 1.5px 1.5px 0 #2E1F3B, -1px -1px 0 #2E1F3B, 1px -1px 0 #2E1F3B, -1px 1px 0 #2E1F3B;
          margin: 0 0 6px;
        }

        .app-tagline {
          color: #5A4770;
          font-size: 1rem;
          margin: 0;
        }

        .create-card-form {
          width: 100%;
          max-width: 480px;
          background: #FFFDF9;
          border: 1px solid rgba(255, 111, 145, 0.15);
          border-radius: 24px;
          box-shadow: 0 10px 30px rgba(46, 31, 59, 0.10);
          padding: 32px 28px;
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-field label {
          font-weight: 600;
          font-size: 0.9rem;
          color: #2E1F3B;
        }

        .form-field input[type="text"],
        .form-field textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 12px 16px;
          border-radius: 12px;
          border: 2px solid #FFF3E2;
          background: #FFFBF5;
          font-size: 1rem;
          font-family: inherit;
          color: #2E1F3B;
          transition: border-color 0.15s ease, background 0.15s ease;
        }

        .form-field input[type="text"]::placeholder,
        .form-field textarea::placeholder {
          color: #B3A6C2;
        }

        .form-field input[type="text"]:focus,
        .form-field textarea:focus {
          outline: none;
          border-color: #FF6F91;
          background: #ffffff;
        }

        .form-field textarea {
          resize: vertical;
          min-height: 120px;
          line-height: 1.6;
        }

        .char-counter {
          align-self: flex-end;
          font-size: 0.78rem;
          color: #B3A6C2;
          margin-top: -2px;
        }

        .field-error {
          color: #E8503A;
          font-size: 0.82rem;
          font-weight: 500;
          margin: 0;
        }

        .photo-dropzone {
          border: 2px dashed #FFC75F;
          border-radius: 16px;
          background: #FFF9EC;
          padding: 28px 16px;
          text-align: center;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
        }

        .photo-dropzone p {
          margin: 0 0 4px;
          font-weight: 600;
          color: #2E1F3B;
        }

        .photo-dropzone:hover {
          background: #FFF3D9;
          border-color: #FF6F91;
        }

        .photo-dropzone:active {
          transform: scale(0.99);
        }

        .photo-dropzone--dragging {
          background: #FFEEF1;
          border-color: #FF6F91;
        }

        .photo-hint {
          font-size: 0.8rem;
          color: #5A4770;
          font-weight: 400 !important;
        }

        .photo-preview-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 12px;
        }

        .photo-preview-item {
          position: relative;
          aspect-ratio: 1 / 1;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 10px rgba(46, 31, 59, 0.15);
          border: 2px solid #ffffff;
        }

        .photo-preview-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .photo-remove-btn {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: none;
          background: rgba(46, 31, 59, 0.75);
          color: #fff;
          font-size: 0.9rem;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .submit-error {
          background: #FFF0EC;
          border: 1px solid rgba(232, 80, 58, 0.3);
          color: #E8503A;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 0.9rem;
          margin: 0;
        }

        .submit-btn {
          width: 100%;
          border: none;
          border-radius: 999px;
          background: #FF6F91;
          color: #FFFBF5;
          font-weight: 700;
          font-size: 1.05rem;
          font-family: 'Poppins', system-ui, sans-serif;
          padding: 15px 20px;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(255, 111, 145, 0.4);
          transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(255, 111, 145, 0.5);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2.5px solid rgba(255, 255, 255, 0.5);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: create-card-spin 0.7s linear infinite;
        }

        @keyframes create-card-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <header className="create-card-header">
        <h1 className="app-logo">🎉 Birthday Wishes</h1>
        <p className="app-tagline">Make someone's birthday special</p>
      </header>

      <form className="create-card-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="recipientName">Recipient Name</label>
          <input
            id="recipientName"
            name="recipientName"
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="e.g. Priya"
            required
            aria-invalid={Boolean(errors.recipientName)}
            aria-describedby={errors.recipientName ? 'recipientName-error' : undefined}
          />
          {errors.recipientName && (
            <p className="field-error" id="recipientName-error">
              {errors.recipientName}
            </p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="message">Birthday Message</label>
          <textarea
            id="message"
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            placeholder="Write a heartfelt birthday message..."
            rows={6}
            required
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? 'message-error' : 'message-counter'}
          />
          <div className="char-counter" id="message-counter">
            {message.length}/{MAX_MESSAGE_LENGTH}
          </div>
          {errors.message && (
            <p className="field-error" id="message-error">
              {errors.message}
            </p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="photos">Photos</label>
          <div
            className={`photo-dropzone${isDragging ? ' photo-dropzone--dragging' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
          >
            <p>Tap or drag photos here</p>
            <p className="photo-hint">
              Up to {MAX_PHOTOS} photos, {MAX_FILE_SIZE_MB}MB each (JPG, PNG, WEBP, GIF)
            </p>
            <input
              ref={fileInputRef}
              id="photos"
              name="photos"
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              multiple
              onChange={handleFileInputChange}
              hidden
            />
          </div>

          {photos.length > 0 && (
            <div className="photo-preview-grid">
              {photos.map((photo, index) => (
                <div className="photo-preview-item" key={photo.previewUrl}>
                  <img src={photo.previewUrl} alt={`Upload preview ${index + 1}`} />
                  <button
                    type="button"
                    className="photo-remove-btn"
                    onClick={() => removePhoto(index)}
                    aria-label={`Remove photo ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {errors.photos && <p className="field-error">{errors.photos}</p>}
        </div>

        {submitError && <p className="submit-error">{submitError}</p>}

        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Creating...
            </>
          ) : (
            'Create Card'
          )}
        </button>
      </form>
    </div>
  );
}