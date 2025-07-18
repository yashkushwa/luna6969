import { useCallback, useEffect, useState } from 'react';

const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    setToasts((prevToasts) => [...prevToasts, toast]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = 'toast-' + Date.now();
    addToast({ id, message, type, duration });
    return id;
  }, [addToast]);

  useEffect(() => {
    const handleShowToast = (event) => {
      const { id, message, type, duration } = event.detail;
      addToast({ id, message, type, duration });
    };

    document.addEventListener('show-toast', handleShowToast);
    
    return () => {
      document.removeEventListener('show-toast', handleShowToast);
    };
  }, [addToast]);

  return {
    toasts,
    showToast,
    removeToast
  };
};

export default useToast; 