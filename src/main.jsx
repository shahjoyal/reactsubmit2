import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { UnitProvider } from './context/UnitContext'
import './index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UnitProvider>
      <App />
    </UnitProvider>
  </React.StrictMode>
)
