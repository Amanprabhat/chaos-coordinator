import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import RoleBasedRouter from './components/RoleBasedRouter';
import ChatbotWidget from './components/ChatbotWidget';
import ForcePasswordChangeModal from './components/ForcePasswordChangeModal';

function App() {
  return (
    <Router>
      <AuthProvider>
        <RoleBasedRouter />
        <ChatbotWidget />
        <ForcePasswordChangeModal />
      </AuthProvider>
    </Router>
  );
}

export default App;
