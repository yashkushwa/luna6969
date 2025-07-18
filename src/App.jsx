import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import VideoLibrary from './pages/VideoLibrary';
import VideoPlayer from './pages/VideoPlayer';
import './App.css';

function App() {
  useEffect(() => {
    // Ensure dark theme is applied to the document
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.setAttribute('data-theme', 'dark');
  }, []);

  return (
    <div className="app" data-theme="dark">
      <Routes>
        <Route path="/" element={<VideoLibrary />} />
        <Route path="/player/:id" element={<VideoPlayer />} />
      </Routes>
    </div>
  );
}

export default App; 