import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Please enter a password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Incorrect password. Please try again.');
        } else {
          setError('Something went wrong. Please try again.');
        }
        setIsSubmitting(false);
        return;
      }

      navigate('/admin/dashboard');
    } catch (err) {
      setError('Unable to reach the server. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Admin Login</h1>
          <p style={styles.tagline}>Sign in to manage birthday cards</p>
        </header>

        <form style={styles.form} onSubmit={handleSubmit} noValidate>
          <div style={styles.field}>
            <label htmlFor="password" style={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              placeholder="Enter admin password"
              style={{
                ...styles.input,
                borderColor: error ? '#E14434' : '#EADFCF',
              }}
              disabled={isSubmitting}
              autoFocus
            />
            {error && <p style={styles.error}>{error}</p>}
          </div>

          <button
            type="submit"
            style={{
              ...styles.button,
              opacity: isSubmitting ? 0.8 : 1,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    boxSizing: 'border-box',
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  container: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: '#FFFFFF',
    borderRadius: '20px',
    boxShadow: '0 8px 24px rgba(46, 31, 59, 0.08)',
    padding: '40px 32px',
    boxSizing: 'border-box',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  title: {
    fontFamily: "'Poppins', system-ui, sans-serif",
    fontWeight: 700,
    fontSize: '28px',
    color: '#2E1F3B',
    margin: '0 0 8px 0',
  },
  tagline: {
    fontSize: '14px',
    color: '#6B5C7A',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#2E1F3B',
  },
  input: {
    fontSize: '16px',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '2px solid #EADFCF',
    backgroundColor: '#FFFBF5',
    color: '#2E1F3B',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  error: {
    fontSize: '13px',
    color: '#E14434',
    margin: '2px 0 0 0',
  },
  button: {
    fontFamily: "'Poppins', system-ui, sans-serif",
    fontSize: '16px',
    fontWeight: 700,
    color: '#FFFFFF',
    backgroundColor: '#FF6F91',
    border: 'none',
    borderRadius: '14px',
    padding: '14px 20px',
    marginTop: '8px',
    transition: 'opacity 0.15s ease',
  },
};

export default AdminLoginPage;