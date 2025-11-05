import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { K8sDataProvider } from './context/K8sDataContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <K8sDataProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </K8sDataProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
)
