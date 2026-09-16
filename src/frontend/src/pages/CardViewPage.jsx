import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import PhotoGallery from '../components/PhotoGallery';
import CustomizedCardTemplate from '../components/CustomizedCardTemplate';
import './CardViewPage.css';

const CardViewPage = () => {
  const { cardId } = useParams();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchCard = async () => {
      setLoading(true);
      setError(false);

      try {
        const response = await fetch(`/api/cards/${cardId}`);

        if (!response.ok) {
          throw new Error('Card not found');
        }

        const data = await response.json();

        if (isMounted) {
          setCard(data);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchCard();

    return () => {
      isMounted = false;
    };
  }, [cardId]);

  const handleShare = useCallback(async () => {
    const shareUrl = window.location.href;
    const shareData = {
      title: card ? `Happy Birthday, ${card.recipientName}!` : 'Birthday Card',
      text: 'Check out this birthday card!',
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // fall through to clipboard copy if share is cancelled/fails
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 2500);
    } catch (err) {
      // clipboard write failed silently
    }
  }, [card]);

  if (loading) {
    return (
      <div className="card-view-page">
        <div className="card-view-container">
          <div className="skeleton skeleton-heading" />
          <div className="skeleton skeleton-message" />
          <div className="skeleton-gallery">
            <div className="skeleton skeleton-photo" />
            <div className="skeleton skeleton-photo" />
            <div className="skeleton skeleton-photo" />
            <div className="skeleton skeleton-photo" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="card-view-page card-view-error">
        <div className="error-content">
          <h1>Card not found</h1>
          <p>We couldn't find the birthday card you're looking for.</p>
          <Link to="/" className="btn-primary">
            Create a New Card
          </Link>
        </div>
      </div>
    );
  }

  const isCustomizedTemplate = card.template === 'Customized-card';

  return (
    <div className="card-view-page">
      <div className="confetti-decoration" aria-hidden="true" />

      <div className="card-view-container">
        <h1 className="card-heading">Happy Birthday, {card.recipientName}!</h1>

        <div className="message-panel">
          <p className="card-message">{card.message}</p>
        </div>

        {isCustomizedTemplate ? (
          <CustomizedCardTemplate
            photos={card.photos}
            recipientName={card.recipientName}
            message={card.message}
          />
        ) : (
          <PhotoGallery photos={card.photos} />
        )}

        <footer className="card-view-footer">
          <Link to="/" className="create-own-link">
            Create your own card
          </Link>
        </footer>
      </div>

      <button
        type="button"
        className="share-button"
        onClick={handleShare}
        aria-label="Share this card"
      >
        Share
      </button>

      {toastVisible && (
        <div className="toast" role="status">
          Link copied!
        </div>
      )}
    </div>
  );
};

export default CardViewPage;