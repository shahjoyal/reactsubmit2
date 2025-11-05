// src/components/Toast.jsx
import React, { useEffect } from 'react';

export default function Toasts({ toasts = [], removeToast }) {
  // toasts: [{ id, message, type }]
  useEffect(() => {
    // nothing here; auto removal is handled by App
  }, [toasts]);

  return (
    <div style={{
      position: 'fixed',
      right: 18,
      top: 78,
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      pointerEvents: 'none'
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          minWidth: 220,
          padding: '10px 12px',
          borderRadius: 10,
          background: t.type === 'error' ? 'linear-gradient(90deg,#ffefef,#ffd6d6)' : 'linear-gradient(90deg,#eefdf3,#ddf8e8)',
          color: t.type === 'error' ? '#7b0f0f' : '#00502a',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          pointerEvents: 'auto',
          fontWeight: 700,
          fontSize: 13
        }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
