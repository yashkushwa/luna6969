import React from 'react';
import { useNavigate } from 'react-router-dom';
import './VideoCard.css';

const VideoCard = ({ video, onContextMenu }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/player/${video.id}`);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (onContextMenu) {
      onContextMenu(e, video);
    }
  };

  return (
    <div 
      className="video-card" 
      data-video-id={video.id} 
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <div className="video-thumbnail">
        <img 
          src={video.thumbnail || 'https://via.placeholder.com/320x180/666/fff?text=No+Thumbnail'} 
          alt={video.title} 
        />
        <div className="video-duration">{video.duration}</div>
      </div>
      <div className="video-info">
        <div className="video-title">{video.title}</div>
        <div className="video-metadata">
          <div className="video-size-container">
            <span className="video-size">{video.size}</span>
            {video.vtt && (
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="sprite-indicator" 
                title="Preview thumbnails available"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <path d="M5 12l5 5l10 -10" />
              </svg>
            )}
          </div>
          <div className="video-date">{video.date}</div>
        </div>
      </div>
    </div>
  );
};

export default VideoCard; 