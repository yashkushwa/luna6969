import React, { useEffect, useState } from 'react';
import axios from 'axios';
import VideoCard from '../components/VideoCard';
import ContextMenu from '../components/ContextMenu';
import { useNavigate } from 'react-router-dom';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import './VideoLibrary.css';

const VideoLibrary = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [currentVideo, setCurrentVideo] = useState(null);
  const { toasts, showToast, removeToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/videos');
      setVideos(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching videos:', err);
      setError('Failed to load videos. Please try again later.');
      showToast('Failed to load videos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleContextMenu = (e, video) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
    setCurrentVideo(video);
  };

  const closeContextMenu = () => {
    setContextMenu(null);
    setCurrentVideo(null);
  };

  const handleContextAction = async (action, video) => {
    if (!video) return;

    switch (action) {
      case 'play':
        navigate(`/player/${video.id}`);
        break;

      case 'rename':
        const newName = prompt('Enter new name:', video.title);
        if (newName && newName.trim() && newName !== video.title) {
          try {
            const response = await axios.post(`/api/rename-video/${video.id}`, {
              newName: newName.trim()
            });

            if (response.status === 200) {
              showToast('Video renamed successfully', 'success');
              await fetchVideos(); // Refresh the video list
            } else {
              showToast(`Failed to rename: ${response.data.error}`, 'error');
            }
          } catch (error) {
            console.error('Error renaming video:', error);
            showToast('Error renaming video', 'error');
          }
        }
        break;

      case 'delete':
        if (window.confirm(`Are you sure you want to delete "${video.title}"?\n\nThis will also delete its thumbnail, sprite, and VTT files.`)) {
          try {
            const response = await axios.delete(`/api/delete-video/${video.id}`);

            if (response.status === 200) {
              showToast('Video deleted successfully', 'success');
              await fetchVideos(); // Refresh the video list
            } else {
              showToast(`Failed to delete: ${response.data.error}`, 'error');
            }
          } catch (error) {
            console.error('Error deleting video:', error);
            showToast('Error deleting video', 'error');
          }
        }
        break;

      case 'refresh-thumbnail':
        showToast('Refreshing thumbnail...', 'info');
        try {
          const response = await axios.post(`/api/refresh-thumbnail/${video.id}`);

          if (response.status === 200 && response.data.newThumbnailUrl) {
            // Update the video in the state with the new thumbnail URL
            setVideos(prevVideos => 
              prevVideos.map(v => 
                v.id === video.id 
                  ? { ...v, thumbnail: response.data.newThumbnailUrl } 
                  : v
              )
            );
            showToast('Thumbnail updated successfully', 'success');
          } else {
            console.error('Failed to refresh thumbnail:', response.data.error);
            showToast('Failed to refresh thumbnail', 'error');
          }
        } catch (error) {
          console.error('Error refreshing thumbnail:', error);
          showToast('Error refreshing thumbnail', 'error');
        }
        break;

      case 'add-sprite':
        const processingToastId = showToast('Generating sprite...', 'info', 0);
        
        try {
          const response = await axios.post(`/api/generate-sprite/${video.id}`);

          // Remove processing toast
          removeToast(processingToastId);

          if (response.status === 200) {
            showToast('Sprite generated successfully', 'success');
            // Refresh the video list to update VTT availability
            await fetchVideos();
          } else {
            console.error('Failed to generate sprite:', response.data.error);
            showToast('Failed to generate sprite', 'error');
          }
        } catch (error) {
          console.error('Error generating sprite:', error);
          // Remove processing toast
          removeToast(processingToastId);
          showToast('Error generating sprite', 'error');
        }
        break;

      default:
        break;
    }

    closeContextMenu();
  };

  return (
    <div className="video-library" data-theme="dark">
      <div className="container">
        <div className="header">
          <h1 className="title">Video Library</h1>
        </div>
        
        {loading ? (
          <div className="loading-state">Loading videos...</div>
        ) : error ? (
          <div className="error-state">{error}</div>
        ) : videos.length === 0 ? (
          <div className="empty-state">No videos found.</div>
        ) : (
          <div className="video-grid">
            {videos.map(video => (
              <VideoCard 
                key={video.id} 
                video={video} 
                onContextMenu={handleContextMenu}
              />
            ))}
          </div>
        )}
      </div>

      <ContextMenu 
        position={contextMenu}
        onClose={closeContextMenu}
        onAction={handleContextAction}
        currentVideo={currentVideo}
      />

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
    </div>
  );
};

export default VideoLibrary; 