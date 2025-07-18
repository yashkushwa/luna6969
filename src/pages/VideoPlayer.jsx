import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import './VideoPlayer.css';

const VideoPlayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const playerInstanceRef = useRef(null);

  useEffect(() => {
    const fetchVideoData = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/videos');
        const videoData = response.data.find(v => v.id === parseInt(id));
        
        if (!videoData) {
          setError('Video not found');
          return;
        }
        
        setVideo(videoData);
      } catch (err) {
        console.error('Error fetching video data:', err);
        setError('Failed to load video data');
      } finally {
        setLoading(false);
      }
    };

    fetchVideoData();

    // Cleanup function
    return () => {
      if (playerInstanceRef.current) {
        playerInstanceRef.current.destroy();
        playerInstanceRef.current = null;
      }
    };
  }, [id]);

  // Initialize Plyr when video data is available and component is mounted
  useEffect(() => {
    if (!video || !videoRef.current) return;

    // Destroy existing player if it exists
    if (playerInstanceRef.current) {
      playerInstanceRef.current.destroy();
      playerInstanceRef.current = null;
    }

    const videoEl = videoRef.current;

    const initializePlayer = () => {
      try {
        const options = {
          controls: [
            'play-large',
            'play',
            'progress',
            'current-time',
            'mute',
            'volume',
            'settings',
            'fullscreen'
          ],
          settings: ['quality', 'speed'],
          autoplay: false,
          loop: { active: false },
          keyboard: { focused: true, global: false },
          tooltips: { controls: true, seek: true },
          ratio: '16:9'
        };
        if (video.vtt) {
          options.previewThumbnails = {
            enabled: true,
            src: video.vtt
          };
        }
        playerInstanceRef.current = new Plyr(videoEl, options);
      } catch (err) {
        console.error('Error initializing Plyr:', err);
      }
    };

    // Initialize when metadata is loaded
    videoEl.addEventListener('loadedmetadata', initializePlayer);
    if (videoEl.readyState >= 1) {
      initializePlayer();
    }

    return () => {
      videoEl.removeEventListener('loadedmetadata', initializePlayer);
    };
  }, [video]);

  const handleBackClick = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="video-player-page" data-theme="dark">
        <div className="player-loading">Loading video...</div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="video-player-page" data-theme="dark">
        <div className="player-error">
          <div>{error || 'Video not found'}</div>
          <button className="back-button" onClick={handleBackClick}>
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-player-page" data-theme="dark">
      <div className="player-wrapper">
        <video 
          ref={videoRef} 
          playsInline 
          controls
          crossOrigin="anonymous"
        >
          <source src={video.url} type="video/mp4" />
          {video.vtt && (
            <track 
              kind="metadata" 
              label="thumbnails" 
              src={video.vtt} 
              default 
            />
          )}
          Your browser does not support the video tag.
        </video>
      </div>
      <div className="player-controls">
        <button className="back-button" onClick={handleBackClick}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Library
        </button>
        <h2 className="video-title">{video.title}</h2>
      </div>
    </div>
  );
};

export default VideoPlayer; 