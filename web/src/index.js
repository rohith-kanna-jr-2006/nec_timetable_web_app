import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';
import App from './App';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Failed to find the root element #root');
}

const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
