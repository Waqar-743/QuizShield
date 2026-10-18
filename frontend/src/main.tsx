import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import PageErrorBoundary from './components/shared/PageErrorBoundary'
import './index.css'

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBasename}>
      <PageErrorBoundary><App /></PageErrorBoundary>
      <Toaster position="top-right" />
    </BrowserRouter>
  </React.StrictMode>,
)
