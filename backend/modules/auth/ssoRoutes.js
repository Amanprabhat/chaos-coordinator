/**
 * Keycloak SSO via OIDC (OpenID Connect)
 *
 * Flow:
 *   GET /api/auth/sso/login      - redirect user to Keycloak login page
 *   GET /api/auth/sso/callback   - Keycloak returns auth code, exchange for tokens,
 *                                  extract roles, find/create user, issue JWT, redirect to frontend
 *   GET /api/auth/sso/status     - check if SSO is configured
 *
 * Required env vars:
 *   KEYCLOAK_URL          - Base URL of your Keycloak server (e.g. https://auth.example.com)
 *   KEYCLOAK_REALM        - Realm name (e.g. chaos-coordinator)
 *   KEYCLOAK_CLIENT_ID    - Client ID registered in Keycloak
 *   KEYCLOAK_CLIENT_SECRET - Client secret from Keycloak
 *   SSO_REDIRECT_URI      - Must match exactly what's registered in Keycloak
 *                           e.g. http://localhost:3001/api/auth/sso/callback
 *   FRONTEND_URL          - Where to redirect after successful SSO
 *                           e.g. http://localhost:3000
 *   JWT_SECRET            - Same secret used by auth-routes.js
 *
 * Role mapping:
 *   Keycloak realm roles are matched against app roles (Admin, Sales, CSM, PM).
 *   The role name in Keycloak must match one of these (case-insensitive).
 *   You can also configure custom mappings via KEYCLOAK_ROLE_<APPROLE>=<keycloak_role_name>.
 *   e.g. KEYCLOAK_ROLE_ADMIN=app-admin KEYCLOAK_ROLE_CSM=customer-success
 *   If no valid role is found, login is rejected.
 */

const axios  = require('axios');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const db     = require('../../database/connection');

const KEYCLOAK_URL     = process.env.KEYCLOAK_URL;
const KEYCLOAK_REALM   = process.env.KEYCLOAK_REALM;
const CLIENT_ID        = process.env.KEYCLOAK_CLIENT_ID;
const CLIENT_SECRET    = process.env.KEYCLOAK_CLIENT_SECRET;
const REDIRECT_URI     = process.env.SSO_REDIRECT_URI   || 'http://localhost:3001/api/auth/sso/callback';
const FRONTEND_URL     = process.env.FRONTEND_URL       || 'http://localhost:3000';
const JWT_SECRET       = process.env.JWT_SECRET         || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN   = process.env.JWT_EXPIRES_IN     || '24h';

// Internal roles that can use SSO. Clients always use username/password.
const SSO_ALLOWED_ROLES = ['Admin', 'Sales', 'CSM', 'PM'];

// Keycloak role names that map to each app role.
// Defaults: same name as app role (case-insensitive match).
// Override via env: KEYCLOAK_ROLE_ADMIN, KEYCLOAK_ROLE_SALES, KEYCLOAK_ROLE_CSM, KEYCLOAK_ROLE_PM
const ROLE_MAP = {
  Admin: (process.env.KEYCLOAK_ROLE_ADMIN || 'Admin').toLowerCase(),
  Sales: (process.env.KEYCLOAK_ROLE_SALES || 'Sales').toLowerCase(),
  CSM:   (process.env.KEYCLOAK_ROLE_CSM   || 'CSM').toLowerCase(),
  PM:    (process.env.KEYCLOAK_ROLE_PM    || 'PM').toLowerCase(),
};

function isConfigured() {
  return !!(KEYCLOAK_URL && KEYCLOAK_REALM && CLIENT_ID && CLIENT_SECRET);
}

function getBaseUrl() {
  return `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect`;
}

/**
 * Extract app role from Keycloak token claims.
 * Checks realm_access.roles first, then resource_access.<clientId>.roles.
 * Returns the matched app role string or null if none found.
 */
function resolveAppRole(claims) {
  const realmRoles = (claims.realm_access && claims.realm_access.roles) || [];
  const clientRoles = (
    claims.resource_access &&
    claims.resource_access[CLIENT_ID] &&
    claims.resource_access[CLIENT_ID].roles
  ) || [];

  const allRoles = [...realmRoles, ...clientRoles].map(r => r.toLowerCase());

  for (const [appRole, keycloakRole] of Object.entries(ROLE_MAP)) {
    if (allRoles.includes(keycloakRole)) {
      return appRole;
    }
  }
  return null;
}

/**
 * Generate a short-lived CSRF state token signed with JWT_SECRET.
 * No session storage required.
 */
function generateState() {
  const nonce = crypto.randomBytes(16).toString('hex');
  return jwt.sign({ nonce, purpose: 'sso_state' }, JWT_SECRET, { expiresIn: '10m' });
}

function validateState(state) {
  try {
    const payload = jwt.verify(state, JWT_SECRET);
    return payload.purpose === 'sso_state';
  } catch {
    return false;
  }
}

const setupSSORoutes = (app) => {
  // ── Initiate SSO login ─────────────────────────────────────────────────────
  // GET /api/auth/sso/login
  app.get('/api/auth/sso/login', (req, res) => {
    if (!isConfigured()) {
      const msg = encodeURIComponent('SSO is not configured on this server. Contact your administrator.');
      return res.redirect(`${FRONTEND_URL}/login?sso_error=${msg}`);
    }

    const state = generateState();
    const params = new URLSearchParams({
      client_id:     CLIENT_ID,
      redirect_uri:  REDIRECT_URI,
      response_type: 'code',
      scope:         'openid profile email',
      state,
    });

    res.redirect(`${getBaseUrl()}/auth?${params.toString()}`);
  });

  // ── Handle Keycloak callback ───────────────────────────────────────────────
  // GET /api/auth/sso/callback
  app.get('/api/auth/sso/callback', async (req, res) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error('Keycloak SSO error:', error, error_description);
      const msg = encodeURIComponent(error_description || 'SSO authentication failed.');
      return res.redirect(`${FRONTEND_URL}/login?sso_error=${msg}`);
    }

    if (!code) {
      return res.redirect(`${FRONTEND_URL}/login?sso_error=${encodeURIComponent('No authorization code received.')}`);
    }

    if (!state || !validateState(String(state))) {
      return res.redirect(`${FRONTEND_URL}/login?sso_error=${encodeURIComponent('Invalid SSO state. Please try again.')}`);
    }

    try {
      // Exchange auth code for tokens
      const tokenResponse = await axios.post(
        `${getBaseUrl()}/token`,
        new URLSearchParams({
          grant_type:    'authorization_code',
          client_id:     CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code:          String(code),
          redirect_uri:  REDIRECT_URI,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const { access_token, id_token } = tokenResponse.data;

      // Decode tokens to get claims (we trust Keycloak directly, no signature re-verify needed)
      const idClaims     = jwt.decode(id_token)     || {};
      const accessClaims = jwt.decode(access_token) || {};

      // Roles come from the access token (Keycloak puts roles there, not in id_token)
      const appRole = resolveAppRole(accessClaims);

      if (!appRole) {
        const assignedRoles = [
          ...((accessClaims.realm_access && accessClaims.realm_access.roles) || []),
        ].join(', ') || 'none';
        console.warn(`SSO: no valid app role found. Keycloak roles: [${assignedRoles}]`);
        const msg = encodeURIComponent(
          'Your account does not have a valid role assigned. Contact your administrator to assign an app role in Keycloak.'
        );
        return res.redirect(`${FRONTEND_URL}/login?sso_error=${msg}`);
      }

      const email   = (idClaims.email || accessClaims.email || idClaims.preferred_username || '').toLowerCase();
      const name    = idClaims.name || accessClaims.name || email.split('@')[0];
      const subject = idClaims.sub  || accessClaims.sub;

      if (!email) {
        const msg = encodeURIComponent('Could not retrieve email from Keycloak. Ensure the email scope is granted.');
        return res.redirect(`${FRONTEND_URL}/login?sso_error=${msg}`);
      }

      // Find or create user
      let user = await db('users').whereRaw('LOWER(email) = ?', [email]).first();

      if (user) {
        // Existing user: block Clients from using SSO
        if (!SSO_ALLOWED_ROLES.includes(user.role)) {
          const msg = encodeURIComponent('Client accounts must use email and password to sign in.');
          return res.redirect(`${FRONTEND_URL}/login?sso_error=${msg}`);
        }
        // Sync role from Keycloak and update SSO metadata
        await db('users').where({ id: user.id }).update({
          role:                 appRole,
          sso_provider:         'keycloak',
          sso_subject:          subject,
          must_change_password: false,
          updated_at:           new Date().toISOString(),
        });
        user = await db('users').where({ id: user.id }).first();
      } else {
        // New user -- auto-create with role from Keycloak (no default)
        const [newId] = await db('users').insert({
          name,
          email,
          role:                 appRole,
          department:           null,
          password_hash:        null,       // SSO users have no password
          is_active:            true,
          must_change_password: false,
          sso_provider:         'keycloak',
          sso_subject:          subject,
          created_at:           new Date().toISOString(),
          updated_at:           new Date().toISOString(),
        });
        user = await db('users').where({ id: newId }).first();
        console.log(`SSO: auto-created user ${email} with role ${appRole}`);
      }

      // Issue JWT (same shape as regular login)
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Audit log
      db('activity_log').insert({
        project_id: null,
        action:     'user_sso_login',
        details:    JSON.stringify({ user_id: user.id, email: user.email, role: user.role, provider: 'keycloak' }),
        created_at: new Date().toISOString(),
      }).catch(() => {});

      console.log(`SSO login: ${user.name} (${user.role})`);

      // Redirect to frontend SSO callback page with JWT in query param
      res.redirect(
        `${FRONTEND_URL}/sso-callback?token=${encodeURIComponent(token)}&name=${encodeURIComponent(user.name)}&role=${encodeURIComponent(user.role)}`
      );

    } catch (err) {
      console.error('SSO callback error:', err.response?.data || err.message);
      const msg = encodeURIComponent('SSO authentication failed. Please try again or use email/password.');
      res.redirect(`${FRONTEND_URL}/login?sso_error=${msg}`);
    }
  });

  // ── SSO config status (for frontend to check if SSO is enabled) ─────────────
  // GET /api/auth/sso/status
  app.get('/api/auth/sso/status', (_req, res) => {
    res.json({ enabled: isConfigured(), provider: isConfigured() ? 'keycloak' : null });
  });
};

module.exports = { setupSSORoutes };
