import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { initializeStorage } from './lib/api';

// Initialize storage seed data
initializeStorage();

// Register PWA Service Worker for offline support & installability
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Ground Manager PWA ServiceWorker registered:', registration.scope);
      })
      .catch((error) => {
        console.log('Ground Manager PWA ServiceWorker registration failed:', error);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
