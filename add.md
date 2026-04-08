High-impact improvements (seamless + “fool proof”)
Persist layout per project

Save node positions (and zoom) in DB so the diagram doesn’t reset every reload.
Add buttons: Auto-layout, Save layout, Reset layout.
Make edge creation safer

Show a small modal on connect: “A blocks B” vs “A is blocked by B” (today it assumes BLOCKS).
If backend rejects (cycle/duplicate), show a toast with the exact reason.
Better edge UX

Add an edge “pill” with the dependency label (Blocks / Blocked by).
Add a visible delete button on hover instead of “click edge deletes immediately” (too easy to misclick).
Status & blocker awareness

Node shows blocked/unblocked badge (e.g., “Blocked by 2”).
Dim nodes that are DONE/READY, highlight nodes that are blocking others.
Filtering + focus tools

Filter by status, assignee, sprint, priority.
“Focus mode”: click a task → show only its upstream blockers + downstream blocked (with depth slider 1–5).
Search box: type a task title → jump/highlight node.
Collapsing / grouping

Collapse subtasks into parent node (“Parent (5 subtasks)”) and expand on click.
Optional grouping by status column (swimlanes) or by assignee.
Quality-of-life

MiniMap toggle, “Center on selection”, “Fit view”, keyboard shortcuts (Del removes selected edge, F fit view).
Right-click context menu on node: Open task, Add blocker, Add blocked task, Copy link.