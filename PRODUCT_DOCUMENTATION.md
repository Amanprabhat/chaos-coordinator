# Chaos Coordinator — Product Documentation

**Version:** 1.0  
**Last Updated:** April 2026  

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Roles](#2-user-roles)
3. [Getting Started](#3-getting-started)
4. [Sales — Intake & Pipeline](#4-sales--intake--pipeline)
5. [Admin — Approvals & User Management](#5-admin--approvals--user-management)
6. [CSM Dashboard](#6-csm-dashboard)
7. [Project Manager Dashboard](#7-project-manager-dashboard)
8. [Client Portal](#8-client-portal)
9. [Change Request Workflow](#9-change-request-workflow)
10. [Analytics](#10-analytics)
11. [Notifications](#11-notifications)
12. [Project Lifecycle](#12-project-lifecycle)
13. [WBS & Gantt Chart](#13-wbs--gantt-chart)
14. [Discussions & Documents](#14-discussions--documents)

---

## 1. Product Overview

Chaos Coordinator is an enterprise project delivery orchestration platform designed to manage the complete lifecycle of client implementation projects — from initial sales intake through delivery, go-live, and beyond.

### What It Does

- Centralises project delivery across Sales, CSM, Project Management, and Client teams
- Provides role-specific dashboards so every user sees exactly what they need
- Automates project planning with a Work Breakdown Structure (WBS) generated from your project parameters
- Manages change requests through a structured, multi-stage approval workflow
- Tracks milestones, risks, tasks, and project health in real time
- Gives clients a dedicated portal to stay informed and raise requests

### Key Benefits

| For Sales | For CSM & PM | For Clients | For Admin |
|-----------|-------------|-------------|-----------|
| Structured intake form | Auto-generated project plans | Real-time project visibility | Full platform oversight |
| Pipeline tracking | Milestone & risk management | Raise and track requests | User management |
| Handover to CSM | Team collaboration tools | Document access | Approval authority |
| CR billing decisions | WBS with Gantt chart | Discussion forum | Analytics & reporting |

---

## 2. User Roles

Chaos Coordinator supports six distinct roles. Each role has its own dashboard and access level.

| Role | Description | Primary Dashboard |
|------|-------------|------------------|
| **Admin** | Full platform access. Manages users, approves projects, has final authority on Change Requests | Admin Dashboard |
| **Sales** | Captures new project intake, schedules meetings, hands projects over to CSM | Sales Dashboard |
| **CSM** (Customer Success Manager) | Owns delivery from handover through go-live. First reviewer on all Change Requests | CSM Dashboard |
| **PM** (Project Manager) | Manages project execution, WBS, milestones, and risks. Second reviewer on Change Requests | Project Dashboard |
| **Product Manager** | Similar to PM — manages product scope and delivery activities | Project Dashboard |
| **Client** | End customer. Views project progress, documents, and raises requests | Client Portal |

---

## 3. Getting Started

### Logging In

1. Open the platform URL in your browser
2. Enter your email address and password
3. Click **Sign In**
4. You will be directed to your role's default dashboard automatically

> **Default passwords** are set by your Admin when your account is created. You will receive your credentials from the Admin team.

### Navigation

- The **sidebar** on the left provides navigation between views
- Your **role badge** and **name** appear in the top-right corner
- The **bell icon** opens your notifications panel
- On mobile, tap the **hamburger menu** (☰) to open the sidebar

---

## 4. Sales — Intake & Pipeline

### Sales Dashboard

The Sales Dashboard gives you an overview of your active pipeline, pending approvals, and action items.

**What you can see:**
- Total projects, active projects, and projects awaiting approval
- Insights panel highlighting projects needing your attention
- Quick access to create a new intake

### Creating a New Project Intake

Click **New Intake** to start the 4-step form. Your progress is saved automatically as a draft.

---

#### Step 1 — Project Basics

| Field | Description |
|-------|-------------|
| Project Type | POC (Proof of Concept) or Actual Project |
| Priority | Critical / High / Medium / Low |
| Deployment Region | Geographic region for hosting |
| Deployment Type | Cloud (SaaS), On-Premise, Hybrid |
| SSO Required | Whether single sign-on is needed |
| Business Objective | What the client wants to achieve |
| Go-Live Deadline | Target date for project completion |

---

#### Step 2 — Client Information

| Field | Description |
|-------|-------------|
| Project Name | Name of the engagement |
| Client Name | Name of the client company |
| Client SPOC Name | Single Point of Contact at client |
| Client SPOC Email | Validated email address |
| Client SPOC Mobile | Contact number |
| Meeting Done | Whether the kickoff meeting has occurred |
| Meeting Date | Date of the meeting (if done) |
| MOM | Minutes of Meeting notes |
| Assign CSM | Select the Customer Success Manager |
| Assign PM | Optional — assign a Project Manager |
| Assign Product Manager | Optional |

---

#### Step 3 — Technical Details

| Field | Description |
|-------|-------------|
| Expected Timeline | Estimated delivery window |
| Integrations Required | Yes/No — triggers additional planning phases |
| Integration Details | What integrations are needed (if yes) |
| SOW Upload | Statement of Work document (PDF/DOC) |

---

#### Step 4 — Project Details

| Field | Description |
|-------|-------------|
| Number of Users | How many users will use the platform |
| Current Tools | Tools the client currently uses |
| Success Criteria | How the client will measure success |
| Budget Range | Indicative budget |

Click **Submit** to create the project. It enters the pipeline at **INTAKE_CREATED** status.

### Draft Auto-Save

The intake form auto-saves your progress in the browser. If you close the page, your draft is restored when you return. Click **Clear draft** to start fresh.

---

## 5. Admin — Approvals & User Management

### Admin Dashboard

The Admin Dashboard provides full visibility across all projects and users on the platform.

### Project Approval

When a project reaches **AWAITING_APPROVAL** status, it appears in your approval queue.

**To approve a project:**
1. Click on the project card to open the Project Drawer
2. Review the project details, team assignment, and uploaded SOW
3. Assign or update the CSM and PM if needed
4. Check the **SOW Acknowledged** checkbox after reviewing the document
5. Click **Approve** — the project moves to **APPROVED** status and the team is notified
6. Or click **Reject** with a reason — Sales is notified to make corrections

### WBS Tracker

View all WBS tasks across every project in one place. Filter by status:
- **All Tasks** — complete view
- **Blocked** — tasks flagged as blocked (requires attention)
- **In Progress** — currently active tasks
- **Not Started** — tasks yet to begin
- **Completed** — finished tasks

### At-Risk Projects

The platform automatically flags projects showing risk signals:
- Blocked tasks
- Overdue milestones
- Low progress relative to timeline
- No project start date set
- Pending client actions

### Final CR Approval

Admin is the final stage in the Change Request workflow. See [Section 9](#9-change-request-workflow) for the full workflow.

**To give final CR approval:**
1. Navigate to the **Pending Final Approval** section
2. Review the full approval trail (CSM notes, MOM, PM effort estimate, Sales billing decision)
3. Enter your **Admin Notes** (mandatory)
4. Click **Approve** — the CR becomes visible to all team members and work can begin
5. Or **Reject** — the CR is closed and the client is notified

### User Management

**To create a new user:**
1. Click **Manage Users** in the sidebar
2. Click **+ New User**
3. Fill in: Name, Email, Role, Department (for PM), Password
4. Click **Save** — credentials are displayed for you to share with the user

**Roles available:** Admin, CSM, PM, Product Manager, Sales, Client

**To assign a Client user to projects:**
1. Open the user in User Management
2. Select which projects they can access
3. Save — the client can now see those projects in their portal

**To deactivate a user:**
- Click the user's **Deactivate** button — they are soft-deleted and cannot log in

---

## 6. CSM Dashboard

### Overview

The CSM Dashboard is your central workspace for managing project delivery. You see only the projects assigned to you.

### Project Cards

Each project you own appears as a card showing:
- Project name and client
- Current status
- Overall completion percentage
- Days until go-live
- Upcoming milestones

Click a project to open the full project view.

### Setting a Project Start Date

Once a project is approved, you need to set the start date to activate the project plan.

1. Open the project
2. Find the **Project Plan** section
3. Enter the start date and click **Set & Recalculate**
4. The system calculates all task planned dates based on working days (Mon–Fri)
5. The plan moves from **Tentative** to **Confirmed**

> Changing the start date recalculates all task dates automatically.

### Milestones

**To create a milestone:**
1. Click **+ Add Milestone**
2. Enter name, description, and due date
3. Save

**To update milestone status:**
- Click on a milestone and change its status: Open → On Track → At Risk → Completed

### Risk Register

**To log a risk:**
1. Click **+ Add Risk**
2. Enter title, description, and severity (Low / Medium / High / Critical)
3. Save

Update risk status as it evolves: Open → Mitigated → Resolved / Accepted

### Delivery Checklist

A role-specific checklist tracks your delivery activities by phase:
- Kickoff
- Configuration & Setup
- Testing & UAT
- Training & Launch
- Handoff

Check off items as you complete them. Progress is saved in your browser.

### CR Review Queue

When a client raises a Change Request or New Requirement, it comes to you first.

**To review a CR:**
1. Open the **CR Requests** section
2. Review the request details
3. Click **Approve** to open the review form:
   - Enter your **CSM Notes**
   - Enter **Meeting Attendees** (comma-separated names)
   - Enter the **MOM Summary** (Minutes of Meeting)
4. Submit — the CR moves to PM for review
5. Or click **Reject** — the CR is closed

> Non-CR types (Bug Reports, Additional Help, Other) come directly to you as **Action Items** — no approval chain needed.

---

## 7. Project Manager Dashboard

### Overview

The Project Dashboard gives you full control over a specific project's execution. Access it by clicking any project from the All Projects view or from your dashboard.

### Tabs

| Tab | What It Shows |
|-----|--------------|
| **Overview** | Project summary, team, client info, key metrics |
| **WBS Plan** | Full Work Breakdown Structure with task details |
| **Gantt Chart** | Timeline view of all tasks and sprints |
| **Discussion** | Team chat and document sharing |
| **CR Review** | Change Requests awaiting PM approval |

### WBS Plan

The WBS is automatically generated when a project is created. It contains:

- **Phases** — high-level delivery phases (Kick-off, Configuration, Testing, Go-Live, etc.)
- **Sprints** — time-boxed work periods within each phase
- **Tasks** — individual work items with owner, duration, and dependencies
- **Milestones** — key delivery checkpoints
- **Deliverables** — outputs to be handed to the client

**Task properties:**
| Property | Description |
|----------|-------------|
| WBS Code | Hierarchical reference (e.g. 1.2.3) |
| Type | Phase / Task / Milestone / Deliverable / etc. |
| Owner Role | CSM / PM / Client |
| Status | Not Started / In Progress / Completed / Blocked |
| Planned Start | Calculated from project start date |
| Planned End | Based on duration in working days |
| Sprint | Which sprint this task belongs to |
| Dependencies | Other tasks this task depends on |

**To update a task status:**
1. Find the task in the WBS
2. Click on it to expand
3. Change the status using the dropdown
4. Save

### Gantt Chart

The Gantt chart shows all tasks plotted on a timeline with:
- Sprint lanes
- Colour-coded task bars by status
- Milestone markers
- Dependencies shown as arrows
- Go-live deadline marker

Scroll horizontally to navigate the full timeline.

### CR Review (PM Stage)

When a CR is approved by CSM, it arrives here for your review.

**To approve a CR as PM:**
1. Open the **CR Review** tab — a badge shows pending count
2. Review the request details and CSM notes/MOM
3. Click **Approve**:
   - Enter your **PM Notes**
   - Enter **Effort in Man-Days** (mandatory for Change Requests and New Requirements)
   - Optionally enter Effort in Hours
4. Submit — the CR moves to Sales for billing decision
5. Or **Reject** — the CR is closed

### Discussions & Documents

See [Section 14](#14-discussions--documents).

---

## 8. Client Portal

### Overview

The Client Portal gives you a clear, real-time view of your project without overwhelming you with internal details.

### What You Can See

- **Project status** and overall completion percentage
- **Go-live countdown** — days remaining to your target date
- **Milestones** — upcoming and completed delivery milestones
- **WBS tasks assigned to you** — your action items with the ability to update status
- **Full WBS plan** — read-only view of all project tasks
- **Gantt chart** — timeline view of the project
- **Documents** — shared files, SOW, and project deliverables
- **Discussion forum** — messages from the project team

### Raising a Request

You can raise four types of requests from your portal:

| Type | When to Use |
|------|-------------|
| **Change Request** | Requesting a change to agreed scope |
| **New Requirement** | Asking for something not in the original scope |
| **Additional Help** | Needing extra support or guidance |
| **Bug Report** | Reporting something that isn't working correctly |
| **Other** | Any other query or request |

**To raise a request:**
1. Click **+ New Request** in the Requests section
2. Select the request type
3. Set priority (Low / Medium / High / Critical)
4. Enter a clear title and description
5. Submit

### Request Status

| Status | Meaning |
|--------|---------|
| **Pending Review** | Your request is being reviewed internally |
| **Approved** | Your request has been approved and work will begin |
| **Rejected** | Your request was not approved (you'll see the reason) |

> Change Requests and New Requirements go through a 4-stage internal approval process. You will see **Pending Review** until fully approved by all parties.

### Your Action Items

The portal highlights WBS tasks assigned to you. You can update these tasks:
- **Not Started** → **In Progress** → **Completed**

This helps the team track client-side activities in real time.

---

## 9. Change Request Workflow

Change Requests (CRs) and New Requirements follow a structured 4-stage approval process before any work begins.

### Workflow Overview

```
Client raises CR
      ↓
  CSM Review  ← CSM adds notes + uploads MOM + meeting attendees
      ↓
   PM Review  ← PM adds effort estimate (man-days) — MANDATORY
      ↓
 Sales Review  ← Sales decides billing type — MANDATORY
      ↓
Admin Approval ← Admin gives final approval with notes — MANDATORY
      ↓
  CR Approved  → Team can begin work
```

### Stage Details

#### Stage 1 — CSM Review
- CSM receives notification when client raises a CR
- CSM schedules a meeting with client, captures MOM
- CSM enters: notes, meeting attendees, MOM summary
- CSM approves or rejects

#### Stage 2 — PM Review
- PM receives notification after CSM approves
- PM reviews scope and estimates effort
- **For Change Requests and New Requirements:** Effort in Man-Days is mandatory
- PM approves or rejects

#### Stage 3 — Sales Review
- Sales receives notification after PM approves
- Sales decides who absorbs the cost:
  - **Paid CR** — client pays for the change
  - **Engineering** — engineering team absorbs the cost
  - **Sales** — sales team absorbs the cost
- **Billing type is mandatory** for Change Requests and New Requirements
- Sales approves or rejects

#### Stage 4 — Admin Final Approval
- Admin receives notification after Sales approves
- Admin reviews the full approval trail (CSM notes, MOM, effort, billing type)
- Admin enters mandatory approval notes
- Admin approves → CR becomes visible to all team members and work can begin
- Admin rejects → CR is closed, client is notified

### Non-CR Request Types

**Bug Reports, Additional Help, and Other** request types skip the approval chain entirely:
- They go directly to CSM as **Action Items**
- CSM is the first owner and handles closure
- No PM, Sales, or Admin involvement required

### Visibility Rules

| Who | What they see |
|-----|--------------|
| Client | "Pending Review" until Admin approves; "Approved" or "Rejected" after |
| CSM | All CRs at CSM Review stage for their projects |
| PM | All CRs at PM Review stage for their projects |
| Sales | All CRs at Sales Review stage |
| Admin | All CRs at Admin Review stage + full audit trail |

---

## 10. Analytics

The Analytics page provides data-driven insights across all projects. Access it from the sidebar.

### Filters

- **Period** — 7, 30, 90, or 180 days
- **Status** — filter by project status
- **Priority** — Critical, High, Medium, Low
- **Project Type** — POC or Actual Project
- **Client** — specific client

### Sections

| Section | What It Shows |
|---------|--------------|
| **KPI Cards** | Total projects, active projects, created this period, average age |
| **Projects by Status** | Breakdown across all pipeline stages |
| **WBS Task Status** | Completion metrics across all tasks |
| **Overdue & Blocked** | Tasks needing urgent attention with full details |
| **Upcoming Go-Lives** | Projects with imminent deadlines |
| **At-Risk Projects** | Health scoring with risk factors |
| **Weekly Activity Trend** | Activity volume over the past 8 weeks |
| **Team Workload** | CSM and PM utilisation |
| **Milestone Stats** | Milestone completion rates |
| **CR Pipeline** | Change Request funnel by approval stage |
| **CR by Type** | Breakdown of request types |
| **CR Billing Type** | Paid vs Engineering vs Sales absorption |
| **Audit Log** | System-wide activity history |

### CR Pipeline Tab

Tracks all Change Requests through the approval stages:
- How many are at each stage (CSM / PM / Sales / Admin / Approved / Rejected)
- Average effort in man-days
- Pending this week vs approved this month

---

## 11. Notifications

The bell icon (🔔) in the top navigation shows your notifications.

### Notification Types

| Type | Triggered When |
|------|---------------|
| Project Approved | Your project gets approved by Admin |
| Project Rejected | Your project is rejected with a reason |
| CR Raised | A client raises a new change request |
| CR Stage Update | A CR moves to the next approval stage |
| CR Deadline | 3-day deadline set after CR approval |
| Task Overdue | A task has passed its planned end date |
| Discussion Mention | Someone @mentions you in a discussion |

### Clicking a Notification

Clicking a notification takes you directly to the relevant part of the platform:
- CR notifications → CR Review tab of the project
- Discussion notifications → Discussion tab
- Task notifications → WBS Plan tab
- Approval notifications → Project overview

### Email Notifications

Key events also trigger email notifications to relevant team members. Ensure your email address is correct in your profile.

---

## 12. Project Lifecycle

A project moves through the following statuses from creation to completion:

```
INTAKE_CREATED
      ↓
MEETING_SCHEDULED
      ↓
MEETING_COMPLETED
      ↓
HANDOVER_PENDING  ← Sales completes handover to CSM
      ↓
AWAITING_APPROVAL ← Admin reviews and approves
      ↓
   APPROVED        ← CSM sets start date, plan confirmed
      ↓
   ACTIVE          ← Delivery in progress
      ↓
  (Completed)
```

| Status | Owner | Description |
|--------|-------|-------------|
| INTAKE_CREATED | Sales | Initial form submitted |
| MEETING_SCHEDULED | Sales | Kickoff meeting booked |
| MEETING_COMPLETED | Sales | Meeting done, MOM captured |
| HANDOVER_PENDING | Sales → CSM | Ready for CSM handover |
| AWAITING_APPROVAL | Admin | Pending Admin review |
| APPROVED | CSM | Project approved, plan tentative until start date set |
| ACTIVE | CSM / PM | Delivery underway |

---

## 13. WBS & Gantt Chart

### Work Breakdown Structure (WBS)

The WBS is the backbone of project planning. It is automatically generated when a project is approved and a start date is set.

**Standard project (no integrations):** 30 working days across 5 sprints  
**Project with integrations:** 45 working days across 6 sprints (includes Integration Phase 2)

### Sprint Structure

| Sprint | Timeline | Focus |
|--------|----------|-------|
| Sprint 0 | Week 0–2 | Kick-off & Planning |
| Sprint 1 | Week 3 | Core Configuration |
| Sprint 2 | Week 4 | Migration & Data Setup |
| Sprint 3 | Week 5–6 | Testing & Validation (SIT & KUT) |
| Sprint 4 | Week 6 | Final Validation & Go-Live |
| Sprint 5 | Week 7–9 | Integration (if applicable) |

### Task Types

| Type | Description |
|------|-------------|
| Phase | High-level phase header |
| Summary | Group of related tasks |
| Task | Individual work item |
| Milestone | Key delivery checkpoint |
| Deliverable | Output to be handed to client |
| Client Requirement | Action required from client |
| Assumption | Documented assumption |
| Risk | Identified risk item |

### Task Status Flow

```
Not Started → In Progress → Completed
                  ↓
               Blocked (can be resolved back to In Progress)
```

`Not Required` is also available for tasks that don't apply to this project.

### Date Calculation

All task dates are calculated from the project start date using **working days only** (Monday–Friday, weekends excluded). Changing the start date recalculates all dates automatically.

---

## 14. Discussions & Documents

### Discussion Forum

Each project has a threaded discussion forum for team communication.

**Features:**
- Post messages visible to the whole project team
- **Private messages** — visible only to internal team (hidden from client)
- **@mention** team members — they receive a notification
- Reply to existing messages

**Client visibility:** Clients see only public messages. Private messages are never shown to clients.

### Document Management

Upload and share project documents within each project.

**Document categories:**
- SOW (Statement of Work)
- Meeting Notes / MOM
- Technical Specifications
- Deliverables
- Other

**To upload a document:**
1. Go to the Discussion tab of a project
2. Click **Upload Document**
3. Select the file and category
4. Add a description
5. Upload — the file is available to download by all project team members

**Clients can download** documents shared in their portal view.

---

## Support

For platform issues or access requests, contact your system administrator.

For questions about a specific project, use the **Discussion** tab within the project — this ensures the right team members are notified.
