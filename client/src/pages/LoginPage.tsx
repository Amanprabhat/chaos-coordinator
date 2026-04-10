import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input } from '../components/ui';

interface Node {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  highlighted?: boolean;
}

const DEMO_ACCOUNTS = [
  { role: 'Admin / CTO',       dept: 'Leadership',          email: 'admin@demo.com',  color: 'bg-purple-500' },
  { role: 'Sales',             dept: 'Business Development', email: 'sales@demo.com',  color: 'bg-blue-500'   },
  { role: 'CSM',               dept: 'Customer Success',     email: 'csm@demo.com',    color: 'bg-teal-500'   },
  { role: 'Project Manager',   dept: 'Project Management',   email: 'pm@demo.com',     color: 'bg-indigo-500' },
  { role: 'Product Manager',   dept: 'Product',              email: 'emma@demo.com',   color: 'bg-pink-500'   },
  { role: 'Client',            dept: 'External',             email: 'client@demo.com', color: 'bg-amber-500'  },
];

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [demoIdx, setDemoIdx] = useState(0);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Initialize animated nodes
  useEffect(() => {
    const initialNodes: Node[] = [
      { id: 1, x: 25, y: 35, vx: 0.025, vy: 0.015, highlighted: true },
      { id: 2, x: 65, y: 25, vx: -0.015, vy: 0.025 },
      { id: 3, x: 45, y: 55, vx: 0.02, vy: -0.015 },
      { id: 4, x: 75, y: 65, vx: -0.025, vy: 0.02 },
      { id: 5, x: 35, y: 75, vx: 0.015, vy: -0.025 },
      { id: 6, x: 85, y: 45, vx: -0.02, vy: 0.015 },
      { id: 7, x: 55, y: 85, vx: 0.025, vy: -0.02 },
      { id: 8, x: 20, y: 55, vx: 0.015, vy: 0.025 },
    ];
    setNodes(initialNodes);
  }, []);

  // Animate nodes
  useEffect(() => {
    const interval = setInterval(() => {
      setNodes(prevNodes => 
        prevNodes.map(node => {
          let newX = node.x + node.vx;
          let newY = node.y + node.vy;
          let newVx = node.vx;
          let newVy = node.vy;

          // Bounce off edges with larger range
          if (newX <= 3 || newX >= 87) {
            newVx = -newVx;
            newX = node.x + newVx;
          }
          if (newY <= 3 || newY >= 87) {
            newVy = -newVy;
            newY = node.y + newVy;
          }

          return {
            ...node,
            x: newX,
            y: newY,
            vx: newVx,
            vy: newVy
          };
        })
      );
    }, 50);

    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Branding + Visual System (60%) */}
      <div className="hidden lg:flex lg:w-3/5 bg-gradient-to-br from-slate-900 to-slate-800 relative overflow-hidden">
        {/* Animated Node System */}
        <svg className="absolute inset-0 w-full h-full">
          {/* Connecting Lines */}
          {nodes.map((node, i) => 
            nodes.slice(i + 1).map(otherNode => {
              const distance = Math.sqrt(
                Math.pow(node.x - otherNode.x, 2) + 
                Math.pow(node.y - otherNode.y, 2)
              );
              if (distance < 30) {
                return (
                  <line
                    key={`${node.id}-${otherNode.id}`}
                    x1={`${node.x}%`}
                    y1={`${node.y}%`}
                    x2={`${otherNode.x}%`}
                    y2={`${otherNode.y}%`}
                    stroke="#6366F1"
                    strokeWidth="0.5"
                    opacity={1 - distance / 30}
                    className="animate-pulse"
                  />
                );
              }
              return null;
            })
          )}

          {/* Nodes */}
          {nodes.map(node => (
            <g key={node.id}>
              {/* Glow Effect */}
              {node.highlighted && (
                <circle
                  cx={`${node.x}%`}
                  cy={`${node.y}%`}
                  r="8"
                  fill="#6366F1"
                  opacity="0.3"
                  className="animate-pulse"
                />
              )}
              
              {/* Node with breathing effect */}
              <motion.circle
                cx={`${node.x}%`}
                cy={`${node.y}%`}
                r={node.highlighted ? "4" : "2"}
                fill={node.highlighted ? "#6366F1" : "#94A3B8"}
                animate={{
                  scale: [0.95, 1.05, 0.95],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className={node.highlighted ? "animate-pulse" : ""}
              />
            </g>
          ))}
        </svg>

        {/* Branding Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 flex flex-col justify-center px-12 py-16"
        >
          {/* Headline - smooth fade in */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold text-white mb-4 leading-tight"
          >
            Bring Order to Execution Chaos
          </motion.h1>

          {/* Subtext - fade + slide */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-slate-300 max-w-lg leading-relaxed"
          >
            Manage projects, handovers, and delivery workflows in one structured system
          </motion.p>

          {/* Feature bullets - animate one by one */}
          <div className="mt-8 space-y-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex items-center space-x-3"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="w-2 h-2 bg-green-400 rounded-full"
              />
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="text-sm text-slate-400"
              >
                Enterprise-grade security
              </motion.span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="flex items-center space-x-3"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: 0.6 }}
                className="w-2 h-2 bg-blue-400 rounded-full"
              />
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.7 }}
                className="text-sm text-slate-400"
              >
                Real-time collaboration
              </motion.span>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Right Side - Login Card (40%) */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-8 lg:p-12 relative">
        {/* Subtle gradient spill from left */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/10 to-transparent pointer-events-none"></div>
        
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="w-full max-w-md relative z-10"
        >
          {/* Login Card */}
          <div className="bg-surface rounded-2xl shadow-2xl border border-border p-8">
            {/* Logo at top - small and centered */}
            <div className="flex justify-center mb-6">
              <img 
                src="/logo192.png" 
                alt="Chaos Coordinator" 
                className="w-16 h-16 object-contain"
              />
            </div>

            {/* Welcome Text */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-textPrimary mb-2">
                Welcome back
              </h2>
              <p className="text-sm text-textSecondary">
                Sign in to your structured workspace
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-textPrimary">
                  Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 pl-10 bg-background border border-border rounded-lg text-textPrimary placeholder-textTertiary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-200"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-textTertiary">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-textPrimary">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 pl-10 bg-background border border-border rounded-lg text-textPrimary placeholder-textTertiary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-200"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-textTertiary">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Submit Button - enhanced interactions */}
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ translateY: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </div>
                ) : (
                  'Sign In'
                )}
              </motion.button>
            </form>

            {/* Demo Accounts Carousel */}
            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-xs text-textTertiary text-center mb-3">
                Demo Accounts — password: <span className="font-mono">password123</span>
              </p>

              {/* Carousel card */}
              <div className="relative flex items-center gap-2">
                {/* Prev */}
                <button
                  type="button"
                  onClick={() => setDemoIdx(i => (i - 1 + DEMO_ACCOUNTS.length) % DEMO_ACCOUNTS.length)}
                  className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-background border border-border text-textTertiary hover:text-textPrimary hover:border-accent transition-colors"
                  aria-label="Previous demo account"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {/* Card */}
                <AnimatePresence mode="wait">
                  <motion.button
                    key={demoIdx}
                    type="button"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.18 }}
                    onClick={() => {
                      setEmail(DEMO_ACCOUNTS[demoIdx].email);
                      setPassword('password123');
                    }}
                    className="flex-1 flex items-center gap-3 px-3 py-2.5 bg-background border border-border rounded-xl hover:border-accent hover:bg-accent/5 transition-all duration-150 text-left group"
                  >
                    <span className={`w-8 h-8 rounded-full ${DEMO_ACCOUNTS[demoIdx].color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {DEMO_ACCOUNTS[demoIdx].role.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-textPrimary leading-tight">
                        {DEMO_ACCOUNTS[demoIdx].role}
                      </p>
                      <p className="text-[10px] text-textTertiary leading-tight">{DEMO_ACCOUNTS[demoIdx].dept}</p>
                      <p className="text-[10px] font-mono text-accent mt-0.5 truncate">{DEMO_ACCOUNTS[demoIdx].email}</p>
                    </div>
                    <span className="ml-auto text-[10px] text-textTertiary group-hover:text-accent transition-colors flex-shrink-0">
                      click to fill
                    </span>
                  </motion.button>
                </AnimatePresence>

                {/* Next */}
                <button
                  type="button"
                  onClick={() => setDemoIdx(i => (i + 1) % DEMO_ACCOUNTS.length)}
                  className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-background border border-border text-textTertiary hover:text-textPrimary hover:border-accent transition-colors"
                  aria-label="Next demo account"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Dot indicators */}
              <div className="flex justify-center gap-1 mt-3">
                {DEMO_ACCOUNTS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setDemoIdx(i)}
                    className={`rounded-full transition-all duration-200 ${
                      i === demoIdx
                        ? 'w-4 h-1.5 bg-accent'
                        : 'w-1.5 h-1.5 bg-border hover:bg-textTertiary'
                    }`}
                    aria-label={`Select ${DEMO_ACCOUNTS[i].role}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
