# Planned Future Features

This document outlines the planned workflow and architectural roadmap for adding advanced productivity features to the Kanban Task Manager.

## 1. WIP (Work in Progress) Limits
**Goal:** Prevent bottlenecks by limiting the number of active tasks in specific columns (e.g., maximum 3 tasks in "Review").
*   **Backend:** Add a `wipLimit` fields to the project columns configuration in the database. When updating a task's status, add validation to block the move if the target column is at capacity.
*   **Frontend:** Update the Kanban board (`dnd-kit`) UI to highlight columns in red when they reach their WIP limit, warning the user.

## 2. Command Palette (Ctrl+K / Cmd+K)
**Goal:** Global quick-search for instant navigation without needing the mouse.
*   **Backend:** Build a generic search endpoint (e.g., `GET /api/search?q=`) that concurrently searches tasks, sprints, projects, and users.
*   **Frontend:** Integrate a library like `cmdk` (often used with Shadcn) to overlay a global search modal, allowing users to jump directly to any resource.

## 3. Task/Project Templates
**Goal:** Save time by auto-generating standard sets of tasks for recurring workflows (e.g., "Feature Launch Checklist").
*   **Backend:** Create a `Template` database model. Implement an endpoint that duplicates template data into real tasks and subtasks for a given project.
*   **Frontend:** Add a "Start from Template" selection dropdown when creating a new project or large parent task.

## 4. Sprint Burndown Charts
**Goal:** Visually track if the team is on schedule to complete the active sprint.
*   **Backend:** Create a mechanism (either daily cron jobs or computed calculations) to snapshot the "remaining work" at the end of each day of a sprint.
*   **Frontend:** Use the `recharts` library to plot a line chart with an "Ideal Burn" line and an "Actual Burn" line on the Sprint Dashboard.

## 5. Velocity Tracking
**Goal:** Help managers understand team capacity over time by measuring output sprint-over-sprint.
*   **Backend:** Build an aggregation endpoint that returns the total count of completed tasks (or story points) for the last 5-10 closed sprints in a project.
*   **Frontend:** Use `recharts` to render a Bar Chart comparing sprint outputs historical data.

## 6. Status-based Assignment (Automations)
**Goal:** "If This, Then That" rules. E.g., automatically assign the QA tester when a task enters the "Testing" column.
*   **Backend:** Introduce a Background Event Listener (Node.js `EventEmitter`). Upon a `task:updated` event, the system checks custom rules stored in Prisma and fires secondary database updates (like reassigning the user) automatically.
*   **Frontend:** Build a rule-builder UI in the Project Settings where managers can easily configure triggers and actions using dropdowns.

## 7. Real-time Collaboration
**Goal:** Instant UI updates when other teammates move cards or edit tasks, eliminating the need to refresh.
*   **Backend:** Expand the current `socket.io` implementation to broadcast events (like `task_moved` or `task_deleted`) to specific project "rooms".
*   **Frontend:** Utilize `socket.io-client` alongside React Query to listen for updates. When an event fires, instantly re-fetch or optimistically update the Kanban board state.

## 8. Smart Task Breakdown (AI)
**Goal:** AI auto-generates subtasks from a single title (e.g., turns "Build Login" into 5 concrete technical steps).
*   **Backend:** Integrate an LLM provider. Provide a `POST /api/ai/breakdown-task` endpoint that takes task context and returns structured JSON subtasks.
*   **Frontend:** Add a magic "sparkles" button in the task modal that calls the AI endpoint and dynamically renders the suggested checklist for the user to approve.
