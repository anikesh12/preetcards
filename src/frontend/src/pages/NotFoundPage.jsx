import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="not-found-page">
      <svg
        className="icon"
        viewBox="0 0 140 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <ellipse cx="70" cy="60" rx="34" ry="30" fill="#FF6F91" opacity="0.5" />
        <line x1="70" y1="90" x2="70" y2="128" stroke="#2E1F3B" strokeWidth="2" />
        <path d="M63 96 Q70 90 77 96" stroke="#2E1F3B" strokeWidth="2" fill="none" />
      </svg>
      <h1>Page Not Found</h1>
      <p>This link doesn't lead anywhere. It may be mistyped or the card may have been removed.</p>
      <Link to="/" className="btn btn-primary">
        Create a Card
      </Link>
    </div>
  );
}
