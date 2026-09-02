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