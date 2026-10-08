import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './design.css'
import './calendar.css'

try {
  document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light'
} catch { /* private mode */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
