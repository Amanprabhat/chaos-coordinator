import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Handles the SSO redirect from the backend.
 * URL: /sso-callback?token=<jwt>&name=<name>&role=<role>
 *
 * The backend already authenticated the user with Keycloak, resolved their role,
 * and issued our app JWT. This page just reads those params, stores the session,
 * and redirects to the appropriate dashboard.
 */
const SSOCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const token = searchParams.get('token');
    const name  = searchParams.get('name')  || '';
    const role  = searchParams.get('role')  || '';

    if (!token || !role) {
      navigate('/login?sso_error=' + encodeURIComponent('SSO session is missing required data. Please try again.'), { replace: true });
      return;
    }

    // Decode JWT payload to get user id and email (no signature check needed -- backend already validated)
    let userId = 0;
    let email  = '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.userId || 0;
      email  = payload.email  || '';
    } catch {
      navigate('/login?sso_error=' + encodeURIComponent('SSO session data is invalid. Please try again.'), { replace: true });
      return;
    }

    const user = {
      id:   userId,
      name,
      email,
      role: role as 'Admin' | 'Sales' | 'CSM' | 'PM' | 'Client',
      must_change_password: false,
    };

    loginWithToken(token, user);
    navigate('/dashboard', { replace: true });
  }, [searchParams, loginWithToken, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <svg
          className="animate-spin h-10 w-10 text-indigo-500 mx-auto"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-sm text-textSecondary">Completing sign-in...</p>
      </div>
    </div>
  );
};

export default SSOCallbackPage;
