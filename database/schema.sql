-- CHAOS COORDINATOR DATABASE SCHEMA
-- PostgreSQL Schema for Sales → Project Creation Workflow

-- 1. USERS TABLE
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'sales', 'pm', 'csm', 'product')),
    department VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. CLIENTS TABLE
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    size VARCHAR(50) CHECK (size IN ('startup', 'small', 'medium', 'large')),
    region VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'at_risk', 'churned')),
    health_score INTEGER DEFAULT 80 CHECK (health_score BETWEEN 0 AND 100),
    csm_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. SOW DOCUMENTS TABLE
CREATE TABLE sow_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'processed', 'failed'))
);

-- 4. AI EXTRACTIONS TABLE
CREATE TABLE ai_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sow_document_id UUID NOT NULL REFERENCES sow_documents(id),
    confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
    extracted_scope TEXT,
    extracted_deliverables JSONB,
    extracted_risks JSONB,
    extracted_dependencies JSONB,
    extracted_timeline VARCHAR(100),
    raw_response JSONB,
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- 5. PROJECTS TABLE
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id),
    sow_document_id UUID REFERENCES sow_documents(id),
    ai_extraction_id UUID REFERENCES ai_extractions(id),
    project_type VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    licenses INTEGER DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    budget DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'USD',
    pm_id UUID REFERENCES users(id),
    sales_rep_id UUID NOT NULL REFERENCES users(id),
    risk_score INTEGER DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
    ai_generated BOOLEAN DEFAULT false,
    user_reviewed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. TEMPLATES TABLE
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    project_type VARCHAR(100) NOT NULL,
    description TEXT,
    default_duration_days INTEGER NOT NULL,
    buffer_percentage INTEGER DEFAULT 15 CHECK (buffer_percentage BETWEEN 0 AND 50),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. TEMPLATE_TASKS TABLE
CREATE TABLE template_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES templates(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    phase VARCHAR(100) NOT NULL,
    sequence_order INTEGER NOT NULL,
    duration_days INTEGER NOT NULL,
    owner_role VARCHAR(50) NOT NULL CHECK (owner_role IN ('pm', 'sales', 'technical', 'csm', 'product')),
    is_parallel BOOLEAN DEFAULT false,
    dependencies JSONB, -- Array of task sequence_orders this depends on
    risk_factors JSONB, -- Risk factors for this task
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. TASKS TABLE
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    template_task_id UUID REFERENCES template_tasks(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    phase VARCHAR(100) NOT NULL,
    sequence_order INTEGER NOT NULL,
    duration_days INTEGER NOT NULL,
    owner_role VARCHAR(50) NOT NULL CHECK (owner_role IN ('pm', 'sales', 'technical', 'csm', 'product')),
    assigned_to UUID REFERENCES users(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'blocked', 'review', 'completed')),
    is_parallel BOOLEAN DEFAULT false,
    dependencies JSONB, -- Array of task IDs this depends on
    risk_flag VARCHAR(20) DEFAULT 'none' CHECK (risk_flag IN ('none', 'low', 'medium', 'high')),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. TASK_DEPENDENCIES TABLE (Explicit dependency tracking)
CREATE TABLE task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id),
    depends_on_task_id UUID NOT NULL REFERENCES tasks(id),
    dependency_type VARCHAR(50) DEFAULT 'finish_to_start' CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, depends_on_task_id)
);

-- 10. PROJECT_RISKS TABLE
CREATE TABLE project_risks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    risk_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    mitigation_plan TEXT,
    owner_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'mitigated', 'accepted', 'closed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. ACTIVITY_LOG TABLE
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    user_id UUID REFERENCES users(id),
    user_name VARCHAR(255),
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('created', 'updated', 'assigned', 'completed', 'commented', 'status_change')),
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_sales_rep_id ON projects(sales_rep_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);

-- TRIGGERS FOR UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_project_risks_updated_at BEFORE UPDATE ON project_risks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- SAMPLE DATA FOR TEMPLATES
INSERT INTO templates (name, project_type, description, default_duration_days, buffer_percentage) VALUES
('Standard Software Implementation', 'software_implementation', 'Standard software deployment and training project', 90, 15),
('Data Migration Project', 'data_migration', 'Data migration and validation project', 60, 20),
('Integration Project', 'integration', 'System integration and API development', 120, 25),
('Training Only', 'training', 'User training and documentation only', 30, 10);

-- SAMPLE TEMPLATE TASKS
INSERT INTO template_tasks (template_id, name, description, phase, sequence_order, duration_days, owner_role, is_parallel, dependencies) VALUES
((SELECT id FROM templates WHERE project_type = 'software_implementation' LIMIT 1), 
 'Project Kickoff', 'Initial project kickoff meeting with stakeholders', 'kickoff', 1, 1, 'pm', false, '[]'),
((SELECT id FROM templates WHERE project_type = 'software_implementation' LIMIT 1), 
 'Requirements Gathering', 'Collect and document business requirements', 'planning', 2, 5, 'pm', false, '[1]'),
((SELECT id FROM templates WHERE project_type = 'software_implementation' LIMIT 1), 
 'Technical Architecture', 'Design technical solution architecture', 'planning', 3, 7, 'technical', false, '[2]'),
((SELECT id FROM templates WHERE project_type = 'software_implementation' LIMIT 1), 
 'Environment Setup', 'Setup development and testing environments', 'setup', 4, 3, 'technical', false, '[3]'),
((SELECT id FROM templates WHERE project_type = 'software_implementation' LIMIT 1), 
 'Software Deployment', 'Deploy software to production environment', 'deployment', 5, 2, 'technical', false, '[4]'),
((SELECT id FROM templates WHERE project_type = 'software_implementation' LIMIT 1), 
 'User Training', 'Conduct end-user training sessions', 'training', 6, 5, 'csm', true, '[5]'),
((SELECT id FROM templates WHERE project_type = 'software_implementation' LIMIT 1), 
 'Documentation', 'Create user manuals and technical documentation', 'documentation', 7, 10, 'pm', true, '[5]'),
((SELECT id FROM templates WHERE project_type = 'software_implementation' LIMIT 1), 
 'Project Closure', 'Final project review and sign-off', 'closure', 8, 1, 'pm', false, '[6,7]');
