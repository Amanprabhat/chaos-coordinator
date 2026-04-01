import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import SalesDashboard from './pages/SalesDashboard';
import LoadingPage from './pages/LoadingPage';
import ErrorPage from './pages/ErrorPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/sales-dashboard" element={<SalesDashboard />} />
          <Route path="/loading" element={<LoadingPage />} />
          <Route path="/error" element={<ErrorPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
