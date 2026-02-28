import { useEffect, useState } from 'react';
import { getTokenExpiresInSeconds, silentRefresh } from 'utils/http';

/**
 * Only shows a banner when the token is critically low (<30s)
 * AND the proactive silent-refresh has already been running.
 * In normal operation this banner should never appear — the
 * silent refresh in http.js keeps the token alive.
 */
export default function SessionExpiryBanner() {
  const [critical, setCritical] = useState(false);

  useEffect(() => {
    const check = () => {
      const secs = getTokenExpiresInSeconds();
      if (secs > 0 && secs <= 30) {
        // Last-resort: try one more silent refresh
        silentRefresh().then((newToken) => {
          // If refresh succeeded, token is renewed — not critical
          setCritical(!newToken);
        });
      } else {
        setCritical(false);
      }
    };

    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!critical) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 9999,
      background: '#f8d7da',
      border: '1px solid #f5c6cb',
      borderRadius: 8,
      padding: '10px 16px',
      fontSize: 13,
      fontWeight: 600,
      color: '#721c24',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <i className="ni ni-time-alarm" style={{ fontSize: 16 }} />
      Session expired — please save your work and log in again
    </div>
  );
}
