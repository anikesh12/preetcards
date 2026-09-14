import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import CreateCardPage from './pages/CreateCardPage.jsx'
import CardViewPage from './pages/CardViewPage.jsx'
import CardCreatedPage from './pages/CardCreatedPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import AdminLoginPage from './pages/AdminLoginPage.jsx'
import AdminDashboardPage from './pages/AdminDashboardPage.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<CreateCardPage />} />
          <Route path="card/:cardId" element={<CardViewPage />} />
          <Route path="card/:cardId/created" element={<CardCreatedPage />} />
          <Route path="admin" element={<AdminLoginPage />} />
          <Route path="admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)