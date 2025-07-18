import React, { useState, useCallback } from 'react';
import Toast from './Toast';

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={removeToast}
        />
      ))}
    </div>
  );
};

// Create a global function to show toasts
export const showToast = (message, type = 'info', duration = 3000) => {
  const toastId = 'toast-' + Date.now();
  const event = new CustomEvent('show-toast', {
    detail: { id: toastId, message, type, duration }
  });
  document.dispatchEvent(event);
  return toastId;
};

export default ToastContainer; 