import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import RoleBasedRouter from './components/RoleBasedRouter';
import ChatbotWidget from './components/ChatbotWidget';

function App() {
  return (
    <Router>
      <AuthProvider>
        <RoleBasedRouter />
        <ChatbotWidget />
      </AuthProvider>
    </Router>
  );
}

export default App;
