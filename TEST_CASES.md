# Chaos Coordinator — Test Cases

**Version:** 1.0  
**Last Updated:** April 2026  
**Environment:** Staging / QA  

---

## How to Use This Document

- Each test case has an **ID**, **description**, **preconditions**, **steps**, and **expected result**
- **Pass** = expected result matches actual result
- **Fail** = actual result differs — log the deviation with a screenshot
- Test cases are grouped by feature area and user role
- Use test users for each role (see Section 1)

---

## 1. Test Users & Credentials

Set up the following test accounts before starting. Create via Admin → User Management.

| Role | Name | Email | Password |
|------|------|-------|----------|
| Admin | Test Admin | admin@test.com | Test@1234 |
| Sales | Test Sales | sales@test.com | Test@1234 |
| CSM | Test CSM | csm@test.com | Test@1234 |
| PM | Test PM | pm@test.com | Test@1234 |
| Product Manager | Test ProdMgr | prodmgr@test.com | Test@1234 |
| Client | Test Client | client@test.com | Test@1234 |

---

## 2. Authentication

### TC-AUTH-001 — Successful Login
**Preconditions:** Test user accounts exist  
**Steps:**
1. Navigate to the platform URL
2. Enter `admin@test.com` and `Test@1234`
3. Click **Sign In**

**Expected:** Redirected to Admin Dashboard. User name and role badge visible in top-right corner.

---

### TC-AUTH-002 — Failed Login (Wrong Password)
**Steps:**
1. Enter `admin@test.com` and `WrongPassword`
2. Click **Sign In**

**Expected:** Error message displayed. No redirect. User remains on login page.

---

### TC-AUTH-003 — Role-Based Redirect
**Steps:** Log in as each of the 6 roles and note which page you land on.

| Role | Expected Landing Page |
|------|-----------------------|
| Admin | Admin Dashboard |
| Sales | Sales Dashboard |
| CSM | CSM Dashboard |
| PM | All Projects / Project Dashboard |
| Product Manager | All Projects / Project Dashboard |
| Client | Client Portal |

**Expected:** Each role lands on the correct dashboard.

---

### TC-AUTH-004 — Logout
**Steps:**
1. Log in as any user
2. Click the user avatar / logout button
3. Confirm logout

**Expected:** Redirected to login page. Cannot access any dashboard URL without re-logging in.

---

### TC-AUTH-005 — Invalid Email Format
**Steps:**
1. Enter `notanemail` in the email field
2. Click **Sign In**

**Expected:** Validation error shown — "Invalid email format" or similar.

---

## 3. Sales Intake Form

### TC-SALES-001 — Open Intake Form
**Preconditions:** Logged in as Sales  
**Steps:**
1. Click **New Intake** or **+ New Project**

**Expected:** 4-step intake form opens. Step 1 of 4 shown in progress indicator.

---

### TC-SALES-002 — Step 1 Validation (Required Fields)
**Steps:**
1. On Step 1, leave all fields blank
2. Click **Next**

**Expected:** Error messages appear on required fields. Cannot proceed to Step 2.

---

### TC-SALES-003 — Complete Step 1
**Steps:**
1. Select **Actual Project** as project type
2. Set Priority to **High**
3. Set Deployment Region to any value
4. Set Deployment Type to any value
5. Enter a Business Objective
6. Set a Go-Live Deadline (future date)
7. Click **Next**

**Expected:** Move to Step 2. Progress bar shows 2/4.

---

### TC-SALES-004 — Step 2 Email Validation
**Steps:**
1. On Step 2, enter `invalidemail` in the Client SPOC Email field
2. Click **Next**

**Expected:** Email validation error shown. Cannot proceed.

---

### TC-SALES-005 — Step 2 Mobile Validation
**Steps:**
1. Enter letters in the Client SPOC Mobile field
2. Click **Next**

**Expected:** Mobile validation error shown.

---

### TC-SALES-006 — Meeting Done Toggle
**Steps:**
1. On Step 2, check **Meeting Done**

**Expected:** Meeting Date and MOM text fields appear.

**Steps:**
2. Uncheck **Meeting Done**

**Expected:** Meeting Date and MOM fields disappear.

---

### TC-SALES-007 — CSM Assignment
**Steps:**
1. On Step 2, open the CSM dropdown

**Expected:** List of active CSM users appears. Can select one.

---

### TC-SALES-008 — Complete Full Intake Submission
**Steps:**
1. Complete all 4 steps with valid data
2. On Step 4, click **Submit**

**Expected:** 
- Success message shown
- Project created with status **INTAKE_CREATED**
- Redirect to Sales Dashboard or project list
- Project visible in Admin's approval queue

---

### TC-SALES-009 — Draft Auto-Save
**Steps:**
1. Complete Steps 1 and 2 of the intake form
2. Close the browser tab without submitting
3. Reopen the intake form

**Expected:** A "Draft restored" banner appears with previous data pre-filled.

---

### TC-SALES-010 — Clear Draft
**Steps:**
1. Open intake form with a saved draft
2. Click **Clear draft**

**Expected:** Form resets to blank. Draft removed from browser storage.

---

### TC-SALES-011 — Scroll to Top on Step Change
**Steps:**
1. Fill Step 1 and scroll down
2. Click **Next** to go to Step 2

**Expected:** Page scrolls back to the top automatically. Step 2 content visible from the top.

---

### TC-SALES-012 — Back Navigation
**Steps:**
1. Progress to Step 3
2. Click **Back**

**Expected:** Returns to Step 2. Previously entered data still present. Page scrolls to top.

---

## 4. Admin — Project Approval

### TC-ADMIN-001 — View Approval Queue
**Preconditions:** At least one project in AWAITING_APPROVAL status  
**Logged in as:** Admin  
**Steps:**
1. Open Admin Dashboard

**Expected:** Project in AWAITING_APPROVAL status visible in the approval queue.

---

### TC-ADMIN-002 — Open Project Drawer
**Steps:**
1. Click on a project awaiting approval

**Expected:** Project drawer slides in showing: project info, client details, SOW if uploaded, team assignment, approve/reject buttons.

---

### TC-ADMIN-003 — Approve Without SOW Acknowledgment
**Steps:**
1. Open a project drawer
2. Click **Approve** without checking "SOW Acknowledged"

**Expected:** Error or prevented — cannot approve without acknowledging SOW.

---

### TC-ADMIN-004 — Approve a Project
**Steps:**
1. Open a project drawer
2. Assign CSM and PM if not already assigned
3. Check **SOW Acknowledged**
4. Click **Approve**

**Expected:**
- Project status changes to **APPROVED**
- Notification sent to CSM and PM
- Project disappears from approval queue
- Project appears in CSM's dashboard

---

### TC-ADMIN-005 — Reject a Project
**Steps:**
1. Open a project drawer
2. Click **Reject**
3. Enter a rejection reason
4. Confirm rejection

**Expected:**
- Project status changes to a rejected state
- Sales receives notification with rejection reason

---

### TC-ADMIN-006 — User Management — Create User
**Steps:**
1. Click **Manage Users**
2. Click **+ New User**
3. Fill: Name, Email, Role = CSM, Password
4. Click **Save**

**Expected:**
- User created successfully
- Credentials displayed
- New user appears in user list

---

### TC-ADMIN-007 — Create Duplicate Email User
**Steps:**
1. Try to create a user with an email that already exists

**Expected:** Error message — email already in use. User not created.

---

### TC-ADMIN-008 — Assign Client to Project
**Steps:**
1. Find or create a Client role user
2. Click **Assign Projects**
3. Select one or more projects
4. Save

**Expected:** Client can now log in and see those projects in their portal.

---

### TC-ADMIN-009 — Deactivate User
**Steps:**
1. Find an active user
2. Click **Deactivate**
3. Confirm

**Expected:** User marked inactive. Cannot log in. Still visible in user list with inactive badge.

---

### TC-ADMIN-010 — WBS Tracker — Filter by Blocked
**Steps:**
1. Open Admin Dashboard
2. Click **Blocked** filter in WBS Tracker

**Expected:** Only tasks with status "Blocked" shown across all projects.

---

### TC-ADMIN-011 — Final CR Approval
**Preconditions:** A CR in **admin_review** stage exists  
**Steps:**
1. Open the **Pending Final Approval** section
2. Click **Approve** on a CR
3. Leave Admin Notes blank and try to submit

**Expected:** Validation error — Admin Notes are mandatory.

**Steps:**
4. Enter admin notes
5. Click **Approve**

**Expected:**
- CR status changes to **Approved**
- `is_team_visible` set to true
- CSM and PM receive notifications
- Client request status shows **Approved** in client portal

---

### TC-ADMIN-012 — Final CR Rejection
**Steps:**
1. Open a CR in admin_review stage
2. Enter admin notes
3. Click **Reject**

**Expected:** CR status changes to **Rejected**. Client notified. CR no longer in team's queue.

---

## 5. CSM Dashboard

### TC-CSM-001 — View Assigned Projects
**Preconditions:** At least one approved project assigned to Test CSM  
**Logged in as:** CSM  
**Steps:**
1. Open CSM Dashboard

**Expected:** Only projects where CSM is `csm_id` are visible. No other projects shown.

---

### TC-CSM-002 — Set Project Start Date
**Steps:**
1. Open an approved project
2. Find the Project Plan section
3. Enter a start date
4. Click **Set & Recalculate**

**Expected:**
- Confirmation message shown
- All WBS task planned dates update based on the new start date
- Plan status changes from "Tentative" to "Confirmed"
- Activity log entry created

---

### TC-CSM-003 — Change Start Date
**Steps:**
1. On a project with an existing start date
2. Change the start date to a different date
3. Click **Set & Recalculate**

**Expected:** All task dates recalculate from the new date. Audit log records the change.

---

### TC-CSM-004 — Create Milestone
**Steps:**
1. Open a project
2. Click **+ Add Milestone**
3. Enter: Name = "UAT Sign-off", Description, Due Date = 30 days from today
4. Save

**Expected:** Milestone appears in the milestone list with status "Open".

---

### TC-CSM-005 — Update Milestone Status
**Steps:**
1. Click on an existing milestone
2. Change status to **At Risk**
3. Save

**Expected:** Milestone badge updates to "At Risk" with amber colouring.

---

### TC-CSM-006 — Delete Milestone
**Steps:**
1. Click on a milestone
2. Click **Delete**
3. Confirm

**Expected:** Milestone removed from the list.

---

### TC-CSM-007 — Log a Risk
**Steps:**
1. Click **+ Add Risk**
2. Enter: Title, Description, Severity = **High**
3. Save

**Expected:** Risk appears in risk register with severity badge "High".

---

### TC-CSM-008 — Resolve a Risk
**Steps:**
1. Find an open risk
2. Change status to **Resolved**
3. Save

**Expected:** Risk status updates to Resolved.

---

### TC-CSM-009 — CR Review — Approve with MOM
**Preconditions:** A CR in `csm_review` stage for CSM's project exists  
**Steps:**
1. Open the **CR Requests** section
2. Click **Approve** on a pending CR
3. Enter CSM Notes: "Reviewed with client — scope confirmed"
4. Enter Attendees: "John Smith, Jane Doe"
5. Enter MOM: "Client agreed to the change. Timeline extended by 2 weeks."
6. Click Submit

**Expected:**
- CR moves to `pm_review` stage
- PM receives notification
- CR disappears from CSM's queue

---

### TC-CSM-010 — CR Review — Reject
**Steps:**
1. Click **Reject** on a pending CR
2. Confirm rejection

**Expected:**
- CR status → Rejected
- Approval stage → rejected
- Client notified

---

### TC-CSM-011 — Non-CR Action Item Visible
**Preconditions:** A Bug Report or Additional Help request submitted by client  
**Steps:**
1. Open CSM Dashboard CR section

**Expected:** Bug Reports and Additional Help requests appear as **Action Items** (not in the multi-stage approval queue).

---

### TC-CSM-012 — Delivery Checklist
**Steps:**
1. Find the Delivery Checklist banner
2. Check off 3 items

**Expected:** Progress percentage increases. Checked items persist after page refresh (stored in browser).

---

## 6. Project Manager Dashboard

### TC-PM-001 — View Project
**Preconditions:** A project assigned to Test PM exists  
**Logged in as:** PM  
**Steps:**
1. Navigate to the project

**Expected:** Project Dashboard opens with tabs: Overview, WBS Plan, Gantt Chart, Discussion, CR Review.

---

### TC-PM-002 — Update WBS Task Status
**Steps:**
1. Open **WBS Plan** tab
2. Find a task with status "Not Started"
3. Change status to **In Progress**
4. Save

**Expected:** Task status updates. Progress percentage recalculates. Activity logged.

---

### TC-PM-003 — WBS Filter by Sprint
**Steps:**
1. Open WBS Plan tab
2. Apply a sprint filter (e.g. Sprint 1)

**Expected:** Only tasks in Sprint 1 visible.

---

### TC-PM-004 — Gantt Chart Renders
**Steps:**
1. Open **Gantt Chart** tab

**Expected:** Timeline with sprint lanes and task bars renders. Scroll horizontally works on wide plans.

---

### TC-PM-005 — CR Review — Approve with Effort
**Preconditions:** A CR in `pm_review` stage exists  
**Steps:**
1. Open **CR Review** tab (badge count should show pending)
2. Click **Approve** on a Change Request
3. Leave Effort in Man-Days blank
4. Try to submit

**Expected:** Validation error — Effort in Man-Days is mandatory for Change Requests.

**Steps:**
5. Enter **Effort in Man-Days:** 5
6. Enter PM Notes: "Scoped — 5 man-days of configuration work"
7. Submit

**Expected:** CR moves to `sales_review` stage. Sales notified.

---

### TC-PM-006 — CR Review — Effort Not Required for Bug Report
**Preconditions:** A Bug Report in PM's queue  
**Steps:**
1. Open CR Review tab
2. Approve a Bug Report without entering effort

**Expected:** No validation error for effort on Bug Reports.

---

### TC-PM-007 — View Project Info Panel
**Steps:**
1. Open the **Overview** tab of a project

**Expected:** Shows: client SPOC details, team members, deployment info, success criteria, budget range, integrations.

---

### TC-PM-008 — Export WBS to Excel
**Steps:**
1. Find the export button in the WBS view
2. Click **Export to Excel**

**Expected:** An XLSX file downloads with the WBS task data.

---

## 7. Client Portal

### TC-CLIENT-001 — View Assigned Projects
**Preconditions:** Client user assigned to at least one project  
**Logged in as:** Client  
**Steps:**
1. Log in and view the portal

**Expected:** Only projects the admin has assigned to this client are visible.

---

### TC-CLIENT-002 — View Project Progress
**Steps:**
1. Open a project

**Expected:** Progress percentage, go-live countdown, milestone list, and task completion stats visible.

---

### TC-CLIENT-003 — Raise a Change Request
**Steps:**
1. Open the Requests section
2. Click **+ New Request**
3. Select Type: **Change Request**
4. Set Priority: **High**
5. Enter Title: "Add new reporting module"
6. Enter Description: "We need a custom reporting dashboard"
7. Submit

**Expected:**
- Request created
- Status shows **Pending Review**
- CSM receives notification

---

### TC-CLIENT-004 — Raise a Bug Report
**Steps:**
1. Raise a request with Type: **Bug Report**

**Expected:**
- Request created
- Goes directly to CSM as action item (no 4-stage approval)
- Status reflects accordingly

---

### TC-CLIENT-005 — CR Status Visibility During Approval
**Preconditions:** A Change Request raised by client is at pm_review stage internally  
**Steps:**
1. Log in as Client
2. View the CR

**Expected:** Status shows **Pending Review** — client cannot see internal stage names.

---

### TC-CLIENT-006 — CR Approved — Client Sees Correct Status
**Preconditions:** A CR fully approved by Admin  
**Steps:**
1. Log in as Client
2. View the CR

**Expected:** Status shows **Approved**. Client can see the final status.

---

### TC-CLIENT-007 — Cannot Edit WBS Tasks Owned by Others
**Steps:**
1. Open WBS Plan tab in Client Portal
2. Find a task with Owner = CSM or PM

**Expected:** Task row is read-only. No status dropdown or edit controls visible.

---

### TC-CLIENT-008 — Can Update Own WBS Tasks
**Steps:**
1. Find a task with Owner = Client
2. Change status to **In Progress**
3. Save

**Expected:** Task status updates. Team receives notification of client's progress.

---

### TC-CLIENT-009 — View Documents
**Steps:**
1. Open the Discussion/Documents tab

**Expected:** Only documents explicitly shared with the client are visible. Internal-only documents not shown.

---

### TC-CLIENT-010 — Post Discussion Message
**Steps:**
1. Open the Discussion tab
2. Type a message: "Can we schedule a review call?"
3. Post

**Expected:** Message appears in the thread. Team members see it. Message shows client's name.

---

### TC-CLIENT-011 — Cannot See Private Messages
**Preconditions:** A team member posted a private message in the project  
**Steps:**
1. Log in as Client
2. Open Discussion tab

**Expected:** Private messages (internal team only) are not visible to the client.

---

### TC-CLIENT-012 — Analytics Chart Direction
**Steps:**
1. Navigate to the **Analytics** tab in Client Portal
2. View the circular progress indicator

**Expected:** Arc progresses from left clockwise through top to right (not top-to-bottom).

---

## 8. Change Request Full Workflow

### TC-CR-001 — End-to-End CR Approval (Change Request)

This is the primary regression test for the full CR workflow.

**Preconditions:**
- Active project with Client, CSM, PM, Sales, and Admin assigned
- Client logged in

**Step 1 — Client Raises CR**
1. Log in as Client
2. Raise a **Change Request** with title "Add SSO Integration" and High priority
3. Verify: Status = **Pending Review**

**Step 2 — CSM Reviews**
4. Log in as CSM
5. Open CR Requests section
6. Verify the request appears in the CSM review queue
7. Click Approve, enter notes, attendees, and MOM
8. Submit
9. Verify: CR moves to `pm_review` stage

**Step 3 — PM Reviews**
10. Log in as PM
11. Open CR Review tab — verify badge count
12. Click Approve on the CR
13. Try submitting without Effort → verify validation error
14. Enter Effort = 3 man-days, add PM notes
15. Submit
16. Verify: CR moves to `sales_review` stage

**Step 4 — Sales Reviews**
17. Log in as Sales
18. Open CR Approvals section
19. Verify the CR shows PM effort and notes
20. Try approving without Billing Type → verify validation error
21. Select **Paid CR** as billing type, add sales notes
22. Submit
23. Verify: CR moves to `admin_review` stage

**Step 5 — Admin Final Approval**
24. Log in as Admin
25. Open Pending Final Approval section
26. Verify full audit trail visible (CSM notes, MOM, effort, billing type)
27. Try approving without Admin Notes → verify validation error
28. Enter admin notes and approve
29. Verify: CR status → **Approved**, `is_team_visible` = true

**Step 6 — Client Sees Approved Status**
30. Log in as Client
31. View the CR
32. Verify: Status = **Approved**

**Expected at each step:** The CR advances correctly, notifications are sent, and validation blocks incomplete submissions.

---

### TC-CR-002 — Non-CR Request Bypasses Approval
**Steps:**
1. Log in as Client
2. Raise an **Additional Help** request
3. Log in as CSM

**Expected:** The request appears directly in CSM's **Action Items** — not in the multi-stage approval queue. No PM, Sales, or Admin involvement.

---

### TC-CR-003 — CSM Rejection Closes CR
**Steps:**
1. Client raises a Change Request
2. CSM rejects it

**Expected:** CR status → Rejected. CR does not proceed to PM. Client notified.

---

### TC-CR-004 — PM Rejection Closes CR
**Steps:**
1. Client raises CR → CSM approves
2. PM rejects it

**Expected:** CR status → Rejected. CR does not proceed to Sales. Client notified.

---

### TC-CR-005 — CR Notification Routes Correctly
**Preconditions:** A CR has been raised  
**Steps:**
1. Log in as CSM
2. Click the notification for the new CR

**Expected:** Navigates to the **CR Review** tab of the relevant project — NOT the WBS/Gantt tab.

---

### TC-CR-006 — Duplicate CR Detection
**Steps:**
1. Two different clients on two different projects raise a CR with identical titles and types

**Expected:** Admin receives a "Multiple clients raised the same request" notification flagging the duplicate.

---

## 9. Notifications

### TC-NOTIF-001 — Bell Shows Unread Count
**Steps:**
1. Have another user take an action that triggers a notification for you
2. Check the bell icon

**Expected:** Red badge with unread count appears on bell icon.

---

### TC-NOTIF-002 — Mark Single Notification Read
**Steps:**
1. Open the notification panel
2. Click an unread notification

**Expected:** Notification marked as read (blue dot disappears). Unread count decreases by 1.

---

### TC-NOTIF-003 — Mark All Read
**Steps:**
1. Open notification panel with multiple unread
2. Click **Mark all read**

**Expected:** All notifications marked read. Unread count → 0.

---

### TC-NOTIF-004 — Notification Click Navigation
**Steps:** For each notification type, click it and verify navigation:

| Notification Type | Expected Destination |
|------------------|---------------------|
| CR Raised | Project → CR Review tab |
| CR Stage Update | Project → CR Review tab |
| Discussion Mention | Project → Discussion tab |
| Task Overdue | Project → WBS Plan tab |
| Project Approved | Project → Overview tab |

---

### TC-NOTIF-005 — Admin Pending Approvals Banner
**Preconditions:** One or more projects in AWAITING_APPROVAL  
**Logged in as:** Admin  
**Steps:**
1. Open notification panel

**Expected:** Purple banner at top showing "X projects awaiting approval". Click navigates to admin dashboard filtered to AWAITING_APPROVAL.

---

## 10. Analytics

### TC-ANALYTICS-001 — Page Loads
**Logged in as:** Admin  
**Steps:**
1. Navigate to Analytics from sidebar

**Expected:** Analytics page loads with KPI cards, charts, and filter controls.

---

### TC-ANALYTICS-002 — Period Filter
**Steps:**
1. Change period filter from 30 to 90 days

**Expected:** Data refreshes. KPI numbers change (or stay same if no new data in range).

---

### TC-ANALYTICS-003 — CR Pipeline Tab
**Preconditions:** At least one CR exists  
**Steps:**
1. Click **CR Pipeline** tab in Analytics

**Expected:**
- KPI cards showing total CRs, average effort, pending this week, approved this month
- Stage funnel showing counts at each approval stage
- Breakdown by request type
- Breakdown by billing type

---

### TC-ANALYTICS-004 — Overdue Tasks List
**Preconditions:** At least one task has passed its planned end date  
**Steps:**
1. View the Overdue & Blocked section

**Expected:** Task name, project, client, owner role, and planned end date shown. Clickable.

---

### TC-ANALYTICS-005 — At-Risk Projects
**Steps:**
1. View the At-Risk Projects section

**Expected:** Projects with blocked tasks, low progress, or overdue items appear with risk signals labelled.

---

### TC-ANALYTICS-006 — Role-Scoped Data
**Steps:**
1. Log in as CSM and view Analytics
2. Log in as Admin and view Analytics

**Expected:** CSM sees only their assigned projects' data. Admin sees all projects.

---

## 11. WBS & Gantt Chart

### TC-WBS-001 — WBS Renders for Project
**Steps:**
1. Open a project with a generated plan
2. Open WBS Plan tab

**Expected:** Hierarchical task structure visible with WBS codes, types, statuses, and dates.

---

### TC-WBS-002 — WBS Shows Tentative Warning
**Preconditions:** Project has no start date set  
**Steps:**
1. Open WBS Plan for a project without a start date

**Expected:** Warning banner shown: "Plan is tentative — set a start date to confirm dates."

---

### TC-WBS-003 — Filter by Status
**Steps:**
1. In WBS Plan, filter by status **Blocked**

**Expected:** Only blocked tasks shown.

---

### TC-WBS-004 — Gantt Horizontal Scroll (Mobile)
**Steps:**
1. Open Gantt Chart tab on a mobile or narrow screen

**Expected:** Gantt chart scrolls horizontally. Content not cut off. Layout not broken.

---

### TC-WBS-005 — Integration Phase Visible
**Preconditions:** A project with Integrations Required = Yes  
**Steps:**
1. Open WBS Plan

**Expected:** Sprint 5 (Integration Phase 2) visible with 15 additional working days.

---

### TC-WBS-006 — Client Can See WBS
**Logged in as:** Client  
**Steps:**
1. Open their project
2. Navigate to WBS tab

**Expected:** WBS plan visible. Client-owned tasks have editable status. All other tasks are read-only.

---

## 12. Discussions & Documents

### TC-DISC-001 — Post a Message
**Steps:**
1. Open Discussion tab in a project
2. Type a message and post

**Expected:** Message appears with sender name, role, and timestamp.

---

### TC-DISC-002 — Private Message Hidden from Client
**Steps:**
1. Log in as CSM
2. Post a **private** message in a project discussion
3. Log in as Client
4. Open Discussion tab

**Expected:** The private message is NOT visible to the client.

---

### TC-DISC-003 — @Mention Autocomplete
**Steps:**
1. In the discussion input, type `@`

**Expected:** Dropdown shows team members on this project. Selecting one inserts their @mention.

---

### TC-DISC-004 — Upload a Document
**Steps:**
1. Click **Upload Document**
2. Select a PDF file
3. Category: MOM
4. Add description: "Meeting notes from kickoff"
5. Upload

**Expected:** Document appears in document list. Downloadable by team members.

---

### TC-DISC-005 — Client Downloads Document
**Preconditions:** A document is shared (not internal-only)  
**Logged in as:** Client  
**Steps:**
1. Open Documents section
2. Click **Download** on a shared document

**Expected:** File downloads successfully.

---

### TC-DISC-006 — Delete Message
**Steps:**
1. Post a message as any user
2. Click **Delete** on the message

**Expected:** Message removed from the thread.

---

## 13. Mobile Responsiveness

### TC-MOBILE-001 — Admin Dashboard on Mobile
**Steps:**
1. Open Admin Dashboard on a 375px wide viewport (iPhone)

**Expected:** Layout adapts. Stats cards stack vertically. No horizontal overflow. Sidebar accessible via hamburger menu.

---

### TC-MOBILE-002 — CSM Dashboard on Mobile
**Steps:**
1. Open CSM Dashboard on mobile viewport

**Expected:** Project cards stack. Stats wrap. Sidebar drawer works with overlay.

---

### TC-MOBILE-003 — Project Dashboard Sidebar on Mobile
**Steps:**
1. Open a project on mobile
2. Tap the hamburger icon

**Expected:** Sidebar slides in as a drawer. Backdrop overlay appears. Tapping outside closes sidebar.

---

### TC-MOBILE-004 — WBS Horizontal Scroll on Mobile
**Steps:**
1. Open WBS Plan on mobile

**Expected:** WBS scrolls horizontally without breaking the page layout.

---

### TC-MOBILE-005 — Gantt Chart on Mobile
**Steps:**
1. Open Gantt Chart on mobile

**Expected:** Gantt scrolls horizontally. Header and row labels remain readable.

---

### TC-MOBILE-006 — Sales Intake Form on Mobile
**Steps:**
1. Open intake form on mobile
2. Progress through all 4 steps

**Expected:** Each step starts from the top. Form fields are full width. No layout breaks.

---

## 14. Edge Cases & Negative Tests

### TC-EDGE-001 — Project with No Start Date
**Steps:**
1. View a project that has been approved but has no start date set

**Expected:** WBS shows "Tentative" warning. Dates show placeholder values. No errors.

---

### TC-EDGE-002 — Empty Project Plan
**Steps:**
1. View a project with no generated plan

**Expected:** Empty state message shown. No JavaScript errors. Option to generate plan visible.

---

### TC-EDGE-003 — CR Approval — Missing Mandatory Fields
| Stage | Missing Field | Expected Error |
|-------|--------------|----------------|
| CSM | No notes AND no MOM | Cannot approve without MOM or notes |
| PM | No effort (for CR type) | Effort in Man-Days is required |
| Sales | No billing type (for CR type) | Billing type is required |
| Admin | No admin notes | Admin notes are required |

---

### TC-EDGE-004 — Client Raises Duplicate Request
**Steps:**
1. Client raises a CR with title "Add Reporting"
2. Another client on a different project raises a CR with same title and type

**Expected:** Admin receives a "Duplicate request" notification.

---

### TC-EDGE-005 — Deactivated User Login
**Steps:**
1. Deactivate a user via Admin → User Management
2. Attempt to log in with that user's credentials

**Expected:** Login fails with appropriate error. User cannot access the platform.

---

### TC-EDGE-006 — Client Accessing Non-Assigned Project URL Directly
**Steps:**
1. Log in as Client
2. Manually enter the URL of a project NOT assigned to this client

**Expected:** Access denied or redirect to client's own portal. No data from the other project visible.

---

### TC-EDGE-007 — Analytics with Zero Data
**Steps:**
1. Set the period filter to a date range with no activity

**Expected:** Charts show empty states gracefully (e.g. "No data available"). No JavaScript errors or broken layouts.

---

## 15. Regression Checklist

Run this after every deployment to verify core functionality is intact.

- [ ] Login works for all 6 roles
- [ ] Sales can submit a new intake form
- [ ] Admin can approve a project
- [ ] Approved project appears in CSM Dashboard
- [ ] CSM can set a start date (dates recalculate)
- [ ] PM can update a WBS task status
- [ ] Client can log in and see their project
- [ ] Client can raise a Change Request
- [ ] CSM receives CR notification routing to CR Review tab (not WBS/Gantt)
- [ ] Full 4-stage CR workflow completes without errors
- [ ] Admin CR approval requires notes
- [ ] Approved CR visible to client as "Approved"
- [ ] Discussion message posts and is visible to team
- [ ] Private message hidden from client
- [ ] Notifications bell shows correct count
- [ ] Analytics page loads with data
- [ ] Mobile sidebar opens and closes via hamburger
- [ ] Gantt chart scrolls horizontally on mobile

---

*End of Test Cases document*
