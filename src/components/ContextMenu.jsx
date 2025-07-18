import React, { useEffect, useRef, useState } from 'react';
import './ContextMenu.css';

const ContextMenu = ({ position, onClose, onAction, currentVideo }) => {
  const menuRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);

  useEffect(() => {
    if (position) {
      setIsVisible(true);
      
      // Adjust position if menu would go off screen
      if (menuRef.current) {
        const menuRect = menuRef.current.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        let adjustedX = position.x;
        let adjustedY = position.y;
        
        if (position.x + menuRect.width > windowWidth) {
          adjustedX = windowWidth - menuRect.width - 10;
        }
        
        if (position.y + menuRect.height > windowHeight) {
          adjustedY = windowHeight - menuRect.height - 10;
        }
        
        menuRef.current.style.left = `${adjustedX}px`;
        menuRef.current.style.top = `${adjustedY}px`;
      }
    } else {
      setIsVisible(false);
    }
  }, [position]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible, onClose]);

  const handleAction = (action) => {
    setProcessingAction(action);
    onAction(action, currentVideo);
  };

  if (!position || !currentVideo) return null;

  return (
    <div 
      ref={menuRef}
      className={`context-menu ${isVisible ? 'show' : ''}`}
    >
      <button 
        className="context-menu-item" 
        data-action="play"
        onClick={() => handleAction('play')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5,3 19,12 5,21"></polygon>
        </svg>
        Play
      </button>
      <button 
        className="context-menu-item" 
        data-action="rename"
        onClick={() => handleAction('rename')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        Rename
      </button>
      <button 
        className="context-menu-item" 
        data-action="delete"
        onClick={() => handleAction('delete')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3,6 5,6 21,6"></polyline>
          <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
        Delete
      </button>
      <button 
        className="context-menu-item" 
        data-action="refresh-thumbnail"
        onClick={() => handleAction('refresh-thumbnail')}
        disabled={processingAction === 'refresh-thumbnail'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
          <path d="M4.05 11a8 8 0 1 1 .5 4m-.5 5v-5h5" />
        </svg>
        {processingAction === 'refresh-thumbnail' ? 'Processing...' : 'Refresh Thumbnail'}
      </button>
      <button 
        className="context-menu-item" 
        data-action="add-sprite"
        onClick={() => handleAction('add-sprite')}
        disabled={processingAction === 'add-sprite'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21,15 16,10 5,21"></polyline>
        </svg>
        {processingAction === 'add-sprite' ? 'Processing...' : 'Add Sprite'}
      </button>
    </div>
  );
};

export default ContextMenu; 