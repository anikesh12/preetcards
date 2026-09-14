import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import CreateCardPage from './pages/CreateCardPage.jsx'
import CardViewPage from './pages/CardViewPage.jsx'
import AdminDashboardPage from './pages/AdminDashboardPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<CreateCardPage />} />
          <Route path="admin" element={<AdminDashboardPage />} />
          <Route path="card/:id" element={<CardViewPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)