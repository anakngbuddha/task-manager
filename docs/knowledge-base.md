# Complete Application Feature Guide

## 🗂️ Projects
- **Create a project**: Navigate to the Workspace **Dashboard** → click the **"New project"** button (top right) → enter a project name. Only authenticated users can create projects. The creator automatically becomes the MASTER_ADMIN.
- **Archive/Complete a project**: Go to the Project Board → click the **Actions** button (top right) → click **"Mark project complete"** or **"Discontinue project"** (Axed). Only MASTER_ADMINs or PROJECT_MANAGERs can do this.
- **View archived projects**: Open the Sidebar → expand the Projects section → click **"Archived"**.
- **Project roles**:
  - MASTER_ADMIN: Full control (create/delete tasks, manage members, change settings)
  - PROJECT_MANAGER: Can create/edit/delete tasks, manage sprints, send invites
  - MEMBER: Can only update the status of tasks assigned to them

## ✅ Tasks
- **Create a task**: Open a project's Board → click the **"+"** icon inside any column. Requires PROJECT_MANAGER or MASTER_ADMIN role.
- **Task types**: EPIC (highest) → STORY → TASK. Child tasks must have a lower hierarchy level than their parent.
- **Task statuses**: TODO → IN_PROGRESS → IN_REVIEW → DONE → READY. Members can drag and drop tasks they are assigned to, but cannot move tasks to READY.
- **Task priority**: LOW, MEDIUM, HIGH, URGENT.
- **Assign tasks**: Set an assignee when creating or editing a task. Leaving it blank assigns it to "EVERYONE".
- **Task dependencies**: Open the **Actions** menu → click **"Dependency Diagram"** to visually see blocking relationships. Cyclic dependencies are prevented.
- **Filter tasks**: On the Project Board, you can toggle between "Sprint Tasks" and "Non-Sprint Tasks", and filter by Epic using the dropdown menus at the top.

## 🏃 Sprints & Backlog
- **View Backlog**: Open a project → click the **Actions** button → click **"Backlog & Sprints"**.
- **Create a sprint**: On the Project Board → click the **Actions** button → click **"Create sprint"**.
- **Start/Complete a sprint**: On the Project Board → select a sprint from the top dropdown → click **"Start Sprint"** or **"Complete Sprint"**.
- **Sprint Report**: Open the **Actions** menu → click **"Sprint report"** to see completion rates and story points.
- **Roadmap**: Open the **Actions** menu → click **"Roadmap"** to see sprints on a timeline.

## 📅 Calendar & Schedules
- **View calendar**: Click **"Calendar"** in the main sidebar. Shows all your schedules and task deadlines.
- **Create a schedule**: On the Calendar page → click any day or click the **"+ New Schedule"** button. Schedule types: MEETING, TRAINING, REVIEW, REMINDER, OTHER.
- **Day view**: Click any day on the calendar for a detailed hour-by-hour view.

## 💬 Messages
- **Project messages**: On the Project Board, click the floating **"Messages"** button at the bottom right, or go to the **Actions** menu → **"Project Logs"**.
- **Read receipts**: Messages show who has read them.

## 👥 Members & Invitations
- **Invite members**: Go to a Project → click the **Actions** button (top right) → click **"Invite members"**. A unique invite link is generated. Share the link with the person you want to invite. Requires PROJECT_MANAGER or MASTER_ADMIN role.
- **Manage roles**: Open the **Actions** menu → click **"View members"** → click the role badge next to a member's name (MASTER_ADMIN only).
- **Remove members**: On the View members page → click the Actions menu next to their name → "Remove Member" (MASTER_ADMIN only).

## ⚡ Automations
- **Create automations**: On the Project Board → click the **Actions** button → click **"Automations"** (has a lightning bolt icon) → click **"New Rule"**.
- **Trigger types**: Task Created, Task Status Changed, Task Assigned, Task Deadline Approaching, etc.
- **Actions**: Set Status, Set Priority, Assign to Member, Add Tag, etc.

## 🔗 GitHub Integration
- **Connect GitHub**: Click your profile status avatar in the bottom left of the sidebar → click **"Profile"** or **"Admin dashboard"** → navigate to GitHub settings to Install GitHub App.
- **View GitHub activity**: On the Project Board → click the **Actions** button → click **"GitHub Activity"**.

## 📁 Files
- **Upload files**: On the Project Board → click the **Actions** button → click **"Project Files"**.

## 📊 Reports
- **Time Report**: Open a task → Time Logs tab → "+ Log Time". 
- **Sprint Report**: Available from the **Actions** menu on the Project Board.

## 👤 Profile & Settings
- **User status**: Click your avatar at the bottom left of the main sidebar. You can set Online / Working / Busy / Away / In Meeting / Offline.
- **Notification preferences**: Click the **Notifications bell** in the top left of the main sidebar.
