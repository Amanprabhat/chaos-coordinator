-- Seed Data for Chaos Coordinator SaaS Implementation Command Center

-- Insert default lifecycle stages
INSERT INTO lifecycle_stages (name, display_order, description) VALUES
('Lead', 1, 'Initial lead qualification and opportunity assessment'),
('POC', 2, 'Proof of Concept phase to validate solution fit'),
('Implementation', 3, 'Full implementation and configuration phase'),
('Go Live', 4, 'Deployment and go-live activities'),
('Hypercare', 5, 'Post-go-live support and stabilization');

-- Insert sample users with different roles
INSERT INTO users (name, email, role) VALUES
('John Smith', 'john.smith@company.com', 'Sales'),
('Sarah Johnson', 'sarah.johnson@company.com', 'CSM'),
('Mike Wilson', 'mike.wilson@company.com', 'PM'),
('Emily Davis', 'emily.davis@company.com', 'Client'),
('Alex Brown', 'alex.brown@company.com', 'Sales'),
('Lisa Anderson', 'lisa.anderson@company.com', 'CSM'),
('Tom Martinez', 'tom.martinez@company.com', 'PM'),
('Jessica Taylor', 'jessica.taylor@company.com', 'Client');

-- Create sample projects for testing
INSERT INTO projects (name, client_name, current_stage_id, owner_id, status, start_date, target_go_live_date) VALUES
('Enterprise CRM Implementation', 'Tech Corp Inc.', 3, 3, 'active', '2024-01-15', '2024-06-30'),
('Marketing Automation Setup', 'Global Marketing Ltd.', 2, 2, 'active', '2024-02-01', '2024-04-15'),
('HR System Migration', 'People First Corp', 1, 1, 'active', '2024-03-01', '2024-08-31'),
('E-commerce Platform', 'Retail Solutions', 4, 3, 'active', '2024-01-01', '2024-03-31');

-- Create sample milestones
INSERT INTO milestones (project_id, name, description, due_date, status, owner_id) VALUES
(1, 'Requirements Gathering', 'Collect and document all business requirements', '2024-01-31', 'completed', 3),
(1, 'System Configuration', 'Configure core CRM modules', '2024-03-15', 'in_progress', 3),
(1, 'Data Migration', 'Migrate existing customer data', '2024-04-30', 'pending', 3),
(1, 'User Training', 'Train end users on new system', '2024-06-15', 'pending', 2),
(2, 'Technical Assessment', 'Evaluate technical requirements', '2024-02-15', 'completed', 2),
(2, 'POC Development', 'Develop proof of concept', '2024-03-15', 'in_progress', 2),
(3, 'Discovery Workshop', 'Initial discovery and requirements workshop', '2024-03-15', 'pending', 1),
(4, 'Go-live Support', 'Post go-live support and monitoring', '2024-04-15', 'completed', 3);

-- Create sample tasks with mandatory owners
INSERT INTO tasks (project_id, milestone_id, title, description, status, owner_id, contributors, due_date, estimated_hours) VALUES
(1, 1, 'Document Business Processes', 'Document all current business processes', 'completed', 3, ARRAY[2], '2024-01-25', 40),
(1, 1, 'Stakeholder Interviews', 'Conduct interviews with key stakeholders', 'completed', 3, ARRAY[1,2], '2024-01-30', 20),
(1, 2, 'Configure Sales Module', 'Set up sales automation features', 'in_progress', 3, ARRAY[2], '2024-03-10', 60),
(1, 2, 'Configure Service Module', 'Set up customer service features', 'todo', 3, ARRAY[2], '2024-03-20', 45),
(1, 3, 'Data Cleansing', 'Clean and prepare existing data', 'todo', 3, ARRAY[2,4], '2024-04-15', 30),
(1, 4, 'Create Training Materials', 'Develop user training documentation', 'todo', 2, ARRAY[1], '2024-05-30', 25),
(2, 5, 'Technical Audit', 'Audit current marketing systems', 'completed', 2, ARRAY[3], '2024-02-10', 15),
(2, 6, 'Build POC Prototype', 'Create working prototype', 'in_progress', 2, ARRAY[3], '2024-03-10', 80),
(3, 7, 'Schedule Workshop', 'Schedule and prepare discovery workshop', 'todo', 1, ARRAY[2], '2024-03-10', 10);

-- Create sample handover notes
INSERT INTO handover_notes (project_id, from_role, to_role, checklist_completed, notes, approved_by) VALUES
(1, 'Sales', 'PM', true, 'Client requirements documented. Budget approved. Timeline confirmed.', 3),
(2, 'Sales', 'CSM', true, 'POC scope defined. Technical requirements gathered. Success criteria agreed.', 2),
(4, 'PM', 'CSM', true, 'Go-live completed successfully. All systems operational. User acceptance confirmed.', 2);

-- Create sample risks
INSERT INTO risks (project_id, description, severity, owner_id, status, mitigation_plan, target_resolution_date) VALUES
(1, 'Client data quality issues may delay migration', 'high', 3, 'open', 'Conduct data quality assessment and cleansing before migration', '2024-04-15'),
(1, 'Limited user adoption may impact success', 'medium', 2, 'mitigating', 'Develop comprehensive change management plan', '2024-05-01'),
(2, 'Technical integration complexity underestimated', 'high', 2, 'open', 'Allocate additional technical resources and extend timeline', '2024-03-20'),
(3, 'Budget constraints may limit scope', 'critical', 1, 'open', 'Prioritize must-have features and phase nice-to-haves', '2024-03-15');

-- Create sample changes
INSERT INTO changes (project_id, description, impact, change_type, approved_by, status, requested_by, implementation_date) VALUES
(1, 'Add custom reporting module', 'Additional 2 weeks development time, $15,000 cost', 'scope', 3, 'approved', 4, '2024-04-30'),
(2, 'Extend POC timeline by 2 weeks', 'Delayed go-live by 2 weeks', 'timeline', 2, 'approved', 2, '2024-04-15'),
(1, 'Add integration with existing ERP system', 'Additional development effort, requires ERP team coordination', 'scope', 3, 'pending', 4, NULL);

-- Verify data insertion
SELECT 'Users:' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 'Lifecycle Stages:', COUNT(*) FROM lifecycle_stages
UNION ALL
SELECT 'Projects:', COUNT(*) FROM projects
UNION ALL
SELECT 'Milestones:', COUNT(*) FROM milestones
UNION ALL
SELECT 'Tasks:', COUNT(*) FROM tasks
UNION ALL
SELECT 'Handover Notes:', COUNT(*) FROM handover_notes
UNION ALL
SELECT 'Risks:', COUNT(*) FROM risks
UNION ALL
SELECT 'Changes:', COUNT(*) FROM changes;
