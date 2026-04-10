import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import RoleBasedRouter from './components/RoleBasedRouter';

function App() {
  return (
    <Router>
      <AuthProvider>
        <RoleBasedRouter />
      </AuthProvider>
    </Router>
  );
}

export default App;
