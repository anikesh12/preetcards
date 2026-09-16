import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import RewardedAdModal from '../components/RewardedAdModal';
import './CreateCardPage.css';

const MAX_PHOTOS = 6;
const MAX_MESSAGE_LENGTH = 500;
const MAX_PHOTO_SIZE_MB = 8;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const TEMPLATES = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Simple, elegant and timeless',
    premium: false,
  },
  {
    id: 'confetti',
    name: 'Confetti Pop',
    description: 'Bright confetti burst celebration',
    premium: false,
  },
  {
    id: 'balloons',
    name: 'Balloon Fiesta',
    description: 'Floating balloons theme',
    premium: false,
  },
  {
    id: 'customized-card',
    name: 'Customized Card',
    description: 'Fully custom, video-guided design',
    premium: true,
    tooltip: 'Watch a video to create this one.',
  },
];

function InfoIcon({ tooltip }) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="info-icon-wrapper"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
      role="button"
      aria-label={tooltip}
    >
      <svg
        className="info-icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="10" fill="#2E1F3B" opacity="0.15" />
        <rect x="11" y="10" width="2" height="7" rx="1" fill="#2E1F3B" />
        <circle cx="12" cy="7" r="1.2" fill="#2E1F3B" />
      </svg>
      {visible && <span className="info-tooltip">{tooltip}</span>}
    </span>
  );
}

export default function CreateCardPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [photos, setPhotos] = useState([]); // { file, previewUrl }
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const [pendingAdUnitId, setPendingAdUnitId] = useState(null);

  const revokePreviews = useCallback((list) => {
    list.forEach((p) => {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    });
  }, []);

  const handleFilesSelected = useCallback(
    (fileList) => {
      const incoming = Array.from(fileList || []);
      if (incoming.length === 0) return;

      setErrors((prev) => ({ ...prev, photos: undefined }));

      setPhotos((prev) => {
        const remainingSlots = MAX_PHOTOS - prev.length;
        if (remainingSlots <= 0) {
          setErrors((e) => ({ ...e, photos: `You can upload up to ${MAX_PHOTOS} photos.` }));
          return prev;
        }

        const valid = [];
        let rejectionMessage = '';

        for (const file of incoming) {
          if (valid.length >= remainingSlots) {
            rejectionMessage = `Only the first ${remainingSlots} photo(s) were added (max ${MAX_PHOTOS}).`;
            break;
          }
          if (!ACCEPTED_TYPES.includes(file.type)) {
            rejectionMessage = 'Some files were skipped — only JPG, PNG, WEBP or GIF images are allowed.';
            continue;
          }
          if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
            rejectionMessage = `Some files were skipped — max size is ${MAX_PHOTO_SIZE_MB}MB per photo.`;
            continue;
          }
          valid.push({ file, previewUrl: URL.createObjectURL(file) });
        }

        if (rejectionMessage) {
          setErrors((e) => ({ ...e, photos: rejectionMessage }));
        }

        return [...prev, ...valid];
      });
    },
    []
  );

  const handleFileInputChange = (e) => {
    handleFilesSelected(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFilesSelected(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const removePhoto = (index) => {
    setPhotos((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const validateForm = () => {
    const newErrors = {};

    if (!recipientName.trim()) {
      newErrors.recipientName = "Recipient name is required.";
    }

    if (!message.trim()) {
      newErrors.message = 'Birthday message is required.';
    } else if (message.length > MAX_MESSAGE_LENGTH) {
      newErrors.message = `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`;
    }

    setErrors((prev) => ({ ...prev, ...newErrors, recipientName: newErrors.recipientName, message: newErrors.message }));
    return Object.keys(newErrors).length === 0;
  };

  const buildFormData = () => {
    const formData = new FormData();
    formData.append('recipientName', recipientName.trim());
    formData.append('message', message.trim());
    formData.append('templateId', selectedTemplate);
    photos.forEach((p) => {
      formData.append('photos', p.file);
    });
    return formData;
  };

  const submitCard = async () => {
    setSubmitting(true);
    setErrors((prev) => ({ ...prev, submit: undefined }));

    try {
      const formData = buildFormData();
      const res = await fetch('/api/cards', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Failed to create card.');
      }

      const data = await res.json();
      const cardId = data.id || data.cardId;

      if (!cardId) {
        throw new Error('No card id returned from server.');
      }

      revokePreviews(photos);
      navigate(`/${cardId}`);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        submit: 'Something went wrong creating your card. Please try again.',
      }));
      setSubmitting(false);
    }
  };

  const handleCreateClick = async () => {
    if (submitting) return;

    const isValid = validateForm();
    if (!isValid) return;

    setSubmitting(true);
    setErrors((prev) => ({ ...prev, submit: undefined }));

    const templateObj = TEMPLATES.find((t) => t.id === selectedTemplate);

    try {
      const configRes = await fetch('/api/config');
      const config = configRes.ok ? await configRes.json() : {};

      if (templateObj?.premium && config?.rewardedAdUnitId) {
        setPendingAdUnitId(config.rewardedAdUnitId);
        setShowAdModal(true);
        setSubmitting(false);
        return;
      }

      await submitCard();
    } catch (err) {
      // If config fetch fails, fall back to submitting without an ad gate.
      await submitCard();
    }
  };

  const handleAdComplete = async () => {
    setShowAdModal(false);
    setPendingAdUnitId(null);
    await submitCard();
  };

  const handleAdClose = () => {
    setShowAdModal(false);
    setPendingAdUnitId(null);
    setSubmitting(false);
  };

  return (
    <div className="create-card-page">
      <header className="create-card-header">
        <h1 className="app-logo">🎂 Birthday Wishes</h1>
        <p className="app-tagline">Make someone's birthday special</p>
      </header>

      <form
        className="create-card-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleCreateClick();
        }}
      >
        <div className="form-field">
          <label htmlFor="recipientName">Recipient Name</label>
          <input
            id="recipientName"
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="e.g. Priya"
            disabled={submitting}
          />
          {errors.recipientName && (
            <span className="field-error">{errors.recipientName}</span>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="message">Birthday Message</label>
          <textarea
            id="message"
            rows={5}
            maxLength={MAX_MESSAGE_LENGTH}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write a heartfelt birthday wish..."
            disabled={submitting}
          />
          <div className="char-counter">
            {message.length}/{MAX_MESSAGE_LENGTH}
          </div>
          {errors.message && <span className="field-error">{errors.message}</span>}
        </div>

        <div className="form-field">
          <label>Photos (optional, up to {MAX_PHOTOS})</label>
          <div
            className="photo-dropzone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            <p>Tap or drag photos here</p>
            <span className="photo-hint">
              JPG, PNG, WEBP or GIF, up to {MAX_PHOTO_SIZE_MB}MB each
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              multiple
              onChange={handleFileInputChange}
              disabled={submitting}
              hidden
            />
          </div>

          {photos.length > 0 && (
            <div className="photo-preview-grid">
              {photos.map((p, index) => (
                <div className="photo-preview-item" key={p.previewUrl}>
                  <img src={p.previewUrl} alt={`Preview ${index + 1}`} />
                  <button
                    type="button"
                    className="photo-remove-btn"
                    onClick={() => removePhoto(index)}
                    disabled={submitting}
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {errors.photos && <span className="field-error">{errors.photos}</span>}
        </div>

        <div className="form-field">
          <label>Choose a Style</label>
          <div className="template-picker-grid">
            {TEMPLATES.map((template) => {
              const isSelected = selectedTemplate === template.id;
              return (
                <button
                  type="button"
                  key={template.id}
                  className={`template-option${isSelected ? ' template-option--selected' : ''}`}
                  onClick={() => setSelectedTemplate(template.id)}
                  disabled={submitting}
                >
                  <div className="template-option-header">
                    <span className="template-name">{template.name}</span>
                    {template.premium && (
                      <span className="premium-badge">PREMIUM</span>
                    )}
                    {template.tooltip && <InfoIcon tooltip={template.tooltip} />}
                  </div>
                  <span className="template-description">{template.description}</span>
                  {isSelected && <span className="template-selected-check">✓ Selected</span>}
                </button>
              );
            })}
          </div>
        </div>

        {errors.submit && <div className="form-error-banner">{errors.submit}</div>}

        <button type="submit" className="create-card-cta" disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Creating...
            </>
          ) : (
            'Create Card'
          )}
        </button>
      </form>

      {showAdModal && (
        <RewardedAdModal
          adUnitId={pendingAdUnitId}
          onComplete={handleAdComplete}
          onClose={handleAdClose}
        />
      )}
    </div>
  );
}