import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

let globalToast = null;

export function useToast() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    globalToast = (msg, type = 'default') => {
      const id = Date.now();
      const event = new CustomEvent('foodprint-toast', { detail: { id, msg, type } });
      document.dispatchEvent(event);
    };
    return () => { globalToast = null; };
  }, []);

  const toast = useCallback((msg, type = 'default') => {
    const event = new CustomEvent('foodprint-toast', { detail: { id: Date.now(), msg, type } });
    document.dispatchEvent(event);
  }, []);

  return toast;
}

export function toast(msg, type = 'default') {
  const event = new CustomEvent('foodprint-toast', { detail: { id: Date.now(), msg, type } });
  document.dispatchEvent(event);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const t = e.detail;
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3000);
    };
    document.addEventListener('foodprint-toast', handler);
    return () => document.removeEventListener('foodprint-toast', handler);
  }, []);

  if (!toasts.length) return null;

  const ICONS = { success: '✓', error: '✕', default: 'ℹ' };

  return createPortal(
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{ICONS[t.type] || ICONS.default}</span>
          {t.msg}
        </div>
      ))}
    </div>,
    document.body
  );
}
