import { useEffect, useState } from 'react';
import { getTokenExpiresInSeconds } from 'utils/http';

export default function SessionExpiryBanner() {
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    const check = () => {
      const secs = getTokenExpiresInSeconds();
      // Only show banner when under 2 minutes
      setSecondsLeft(secs > 0 && secs <= 120 ? secs : null);
    };

    check();
    const interval = setInterval(check, 10000); // check every 10s
    return () => clearInterval(interval);
  }, []);

  if (!secondsLeft) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const label = mins > 0
    ? `${mins}m ${secs}s`
    : `${secs}s`;

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 9999,
      background: '#fff3cd',
      border: '1px solid #ffc107',
      borderRadius: 8,
      padding: '10px 16px',
      fontSize: 13,
      fontWeight: 600,
      color: '#856404',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <i className="ni ni-time-alarm" style={{ fontSize: 16 }} />
      Session refreshing in {label}
    </div>
  );
}
