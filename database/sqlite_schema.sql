-- SQLite-compatible schema for Chaos Coordinator
PRAGMA foreign_keys = ON;

-- Drop existing tables
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS milestones;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS users;

-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    role TEXT NOT NULL CHECK (role IN ('Sales', 'CSM', 'PM', 'Client', 'Admin')),
    department TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    client_name TEXT,
    status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
    stage TEXT DEFAULT 'intake' CHECK (stage IN ('intake', 'kickoff', 'planning', 'execution', 'review', 'completed')),
    pm_id INTEGER,
    sales_owner_id INTEGER,
    csm_id INTEGER,
    start_date DATE,
    target_date DATE,
    actual_end_date DATE,
    budget_allocated DECIMAL(12,2),
    budget_consumed DECIMAL(12,2) DEFAULT 0,
    health_score INTEGER DEFAULT 80 CHECK (health_score BETWEEN 0 AND 100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pm_id) REFERENCES users(id),
    FOREIGN KEY (sales_owner_id) REFERENCES users(id),
    FOREIGN KEY (csm_id) REFERENCES users(id)
);

-- Milestones table
CREATE TABLE milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
    owner_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Tasks table
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'blocked')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    assignee_id INTEGER,
    creator_id INTEGER,
    due_date DATE,
    completion_comment TEXT,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (assignee_id) REFERENCES users(id),
    FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- Insert sample data
INSERT INTO users (name, email, role, department) VALUES
('Admin User', 'admin@chaoscoordinator.com', 'PM', 'Management'),
('Sarah Sales', 'sarah@chaoscoordinator.com', 'Sales', 'Sales'),
('Mike PM', 'mike@chaoscoordinator.com', 'PM', 'Project Management'),
('Lisa CSM', 'lisa@chaoscoordinator.com', 'CSM', 'Customer Success'),
('Tom Product', 'tom@chaoscoordinator.com', 'PM', 'Product'),
('Demo User', 'demo@example.com', 'Sales', 'Demo');

INSERT INTO projects (name, description, client_name, status, stage, pm_id, sales_owner_id, csm_id) VALUES
('Website Redesign', 'Complete overhaul of company website', 'Acme Corp', 'active', 'execution', 3, 2, 4),
('Mobile App Development', 'Native iOS and Android app', 'Tech Startup', 'planning', 'planning', 3, 2, 4),
('Marketing Campaign', 'Q4 marketing automation', 'Retail Co', 'active', 'execution', 3, 2, 4);

INSERT INTO milestones (project_id, name, description, due_date, status, owner_id) VALUES
(1, 'Design Mockups', 'Complete UI/UX designs', '2024-04-15', 'completed', 3),
(1, 'Frontend Development', 'Implement frontend', '2024-05-01', 'in_progress', 3),
(2, 'Requirements Gathering', 'Collect all requirements', '2024-04-20', 'pending', 3),
(3, 'Campaign Strategy', 'Define marketing strategy', '2024-04-10', 'completed', 4);

INSERT INTO tasks (project_id, title, description, status, priority, assignee_id, creator_id, due_date) VALUES
(1, 'Create homepage design', 'Design the main homepage', 'completed', 'high', 3, 3, '2024-04-10'),
(1, 'Implement responsive layout', 'Make site mobile-friendly', 'in_progress', 'medium', 3, 3, '2024-04-20'),
(2, 'User research', 'Conduct user interviews', 'todo', 'high', 4, 3, '2024-04-15'),
(3, 'Social media strategy', 'Plan social media approach', 'completed', 'medium', 4, 4, '2024-04-05');
