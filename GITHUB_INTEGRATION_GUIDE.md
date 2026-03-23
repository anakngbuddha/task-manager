# GitHub Integration Guide

The Task Manager supports GitHub integration to automatically keep your tasks up to date and provide visibility into development activity right on your project's activity feed!

## How it works
The integration works by installing our GitHub App onto your personal or organizational GitHub account. Once installed, you can link specific repositories to your project. The task manager will then listen for relevant events (Pushes, Pull Requests) and sync them.

## 1. Connect a Project to GitHub
1. Open your project in the Task Manager.
2. Navigate to **Project Settings** from the sidebar.
3. Locate the **GitHub Integration** section and click **Connect GitHub**.
4. You will be redirected to GitHub to install the `wsi-taska` App. Select which account/organization and repositories you want to grant access to.
5. Once completed, you will be redirected back here automatically, and you should see an "Installation ID" with your connected repositories displayed!

## 2. Linking Pull Requests to Tasks
To automate your task workflow:
1. Open any task in your project.
2. In the task details, find the **GitHub PR URL** field.
3. Paste the URL to a GitHub Pull Request (e.g., `https://github.com/your-username/repo-name/pull/1`).

**Automation Flow:**
- PR **Opened** -> Task moves to *In Progress*
- PR **Merged** -> Task moves to *Done* 
- PR **Closed** (without merging) -> Task moves to *In Review*

## 3. Monitoring Activity & Notifications
All GitHub events linked to your connected repositories will automatically populate in your project!
- **Activity Feed**: View all `Push`, `PR opened`, and `PR merged` events from your team on the **Activity Page** or on the **Dashboard** widgets.
- **Notifications**: Assignees of tasks will automatically be notified in the top-right notification bell whenever the Task status changes due to a Pull Request update.

Note: GitHub webhook limits mean we track *Pushes* and *Pull Requests*, but do not track local developer events like *Clones* or *Pulls*.

## Frequently Asked Questions
**Q: Can I connect multiple repositories to one project?**
A: Yes! When installing the GitHub app, simply select all the repositories that support that specific project.

**Q: Can I manually link an installation?**
A: Yes! On the project settings page, there is an option manually link an installation via its Installation ID if you have previously installed the app.
