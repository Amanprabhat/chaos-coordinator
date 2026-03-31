-- Chaos Coordinator SaaS Implementation Command Center
-- Production-grade database schema for SaaS onboarding teams

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS changes CASCADE;
DROP TABLE IF EXISTS risks CASCADE;
DROP TABLE IF EXISTS handover_notes CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS milestones CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS lifecycle_stages CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users Table (Enhanced with Hierarchy)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Sales', 'CSM', 'PM', 'Client')),
    department VARCHAR(100),
    manager_id INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lifecycle Stages Table
CREATE TABLE lifecycle_stages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_order INTEGER NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects Table
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    current_stage_id INTEGER NOT NULL REFERENCES lifecycle_stages(id),
    owner_id INTEGER NOT NULL REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled')),
    start_date DATE,
    target_go_live_date DATE,
    actual_go_live_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Milestones Table
CREATE TABLE milestones (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
    owner_id INTEGER NOT NULL REFERENCES users(id),
    completion_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks Table (Enhanced with Accountability and SLA)
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id INTEGER REFERENCES milestones(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'blocked', 'at_risk', 'reopened')),
    owner_id INTEGER NOT NULL REFERENCES users(id),
    accountable_id INTEGER REFERENCES users(id),
    watchers INTEGER[] DEFAULT '{}',
    due_date DATE,
    estimated_hours INTEGER,
    actual_hours INTEGER,
    sla_hours INTEGER DEFAULT 0,
    sla_start_time TIMESTAMP,
    sla_paused BOOLEAN DEFAULT FALSE,
    sla_pause_reason TEXT,
    sla_breached BOOLEAN DEFAULT FALSE,
    completion_comment TEXT CHECK (length(completion_comment) >= 15),
    reopened BOOLEAN DEFAULT FALSE,
    reopen_reason TEXT,
    completion_date DATE,
    blocked_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Enforce mandatory owner and accountable constraints
    CONSTRAINT tasks_owner_required CHECK (owner_id IS NOT NULL),
    CONSTRAINT tasks_sla_validation CHECK (sla_hours >= 0),
    CONSTRAINT tasks_comment_quality CHECK (completion_comment IS NULL OR length(completion_comment) >= 15)
);

-- Handover Notes Table
CREATE TABLE handover_notes (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    from_role VARCHAR(50) NOT NULL CHECK (from_role IN ('Sales', 'CSM', 'PM', 'Client')),
    to_role VARCHAR(50) NOT NULL CHECK (to_role IN ('Sales', 'CSM', 'PM', 'Client')),
    checklist_completed BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    approved_by INTEGER REFERENCES users(id),
    handover_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure from_role and to_role are different
    CONSTRAINT handover_different_roles CHECK (from_role != to_role)
);

-- Risks Table
CREATE TABLE risks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    owner_id INTEGER NOT NULL REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'mitigating', 'resolved', 'accepted')),
    mitigation_plan TEXT,
    identified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    target_resolution_date DATE,
    actual_resolution_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Assets Table (Enhanced with Client Approval)
CREATE TABLE knowledge_assets (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    asset_type VARCHAR(50) NOT NULL DEFAULT 'guide' CHECK (asset_type IN ('faq', 'decision_tree', 'guide', 'template', 'process', 'checklist')),
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
    owner_id INTEGER NOT NULL REFERENCES users(id),
    approved_by_client BOOLEAN DEFAULT FALSE,
    approved_by_internal BOOLEAN DEFAULT FALSE,
    client_approval_date TIMESTAMP,
    internal_approval_date TIMESTAMP,
    version INTEGER DEFAULT 1,
    is_client_facing BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Changes Table
CREATE TABLE changes (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    impact TEXT NOT NULL,
    change_type VARCHAR(50) NOT NULL DEFAULT 'scope' CHECK (change_type IN ('scope', 'timeline', 'budget', 'resources')),
    approved_by INTEGER REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'implemented')),
    requested_by INTEGER NOT NULL REFERENCES users(id),
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approval_date TIMESTAMP,
    implementation_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_stage ON projects(current_stage_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_milestones_project ON milestones(project_id);
CREATE INDEX idx_milestones_owner ON milestones(owner_id);
CREATE INDEX idx_milestones_status ON milestones(status);
CREATE INDEX idx_milestones_due_date ON milestones(due_date);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_milestone ON tasks(milestone_id);
CREATE INDEX idx_tasks_owner ON tasks(owner_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_handover_notes_project ON handover_notes(project_id);
CREATE INDEX idx_handover_notes_roles ON handover_notes(from_role, to_role);
CREATE INDEX idx_risks_project ON risks(project_id);
CREATE INDEX idx_risks_severity ON risks(severity);
CREATE INDEX idx_risks_status ON risks(status);
CREATE INDEX idx_changes_project ON changes(project_id);
CREATE INDEX idx_changes_status ON changes(status);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON milestones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_handover_notes_updated_at BEFORE UPDATE ON handover_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_risks_updated_at BEFORE UPDATE ON risks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_changes_updated_at BEFORE UPDATE ON changes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts with roles (Sales, CSM, PM, Client)';
COMMENT ON TABLE projects IS 'Main project records with lifecycle stage tracking';
COMMENT ON TABLE lifecycle_stages IS 'Predefined stages: Lead, POC, Implementation, Go Live, Hypercare';
COMMENT ON TABLE milestones IS 'Project milestones with due dates and owners';
COMMENT ON TABLE tasks IS 'Individual tasks with mandatory owner assignment';
COMMENT ON TABLE handover_notes IS 'Handover documentation between roles';
COMMENT ON TABLE risks IS 'Risk tracking and mitigation';
COMMENT ON TABLE changes IS 'Change request management';
