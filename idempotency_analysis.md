# Idempotency Analysis: Task Manager Project

This document provides an analysis of the current idempotency implementation in the project and recommendations for where to integrate a more robust solution.

## Current State of Idempotency

Currently, the project **does not have a generic idempotency mechanism** (e.g., using an `Idempotency-Key` header). However, several parts of the application implement **natural idempotency** or application-level guards to prevent duplicate actions.

### 1. Database-Level Unique Constraints
The following models in `schema.prisma` have unique constraints that prevent duplicate record creation at the database level:
- **`TaskDependency`**: `@@unique([blockingTaskId, blockedTaskId])` - Prevents duplicate dependencies between the same two tasks.
- **`TaskGithubLink`**: `@@unique([taskId, url])` - Prevents linking the same GitHub URL multiple times to one task.
- **`ScheduleAttendee`**: `@@unique([scheduleId, email])` - Prevents adding the same attendee twice to a schedule.
- **`DashboardLayout`**: `@@unique([userId, projectId])` - Ensures a user only has one layout per project.
- **`ScheduleNotificationLog`**: Unique constraints on schedule/task IDs and notification types to avoid duplicate reminders.

### 2. Application-Level Guards
Several routes perform manual checks before creating resources:
- **Task Creation (`POST /tasks`)**: Checks if a task with the same title already exists in the destination project.
- **Project Creation (`POST /projects`)**: Checks if the user already has an active project with the same name.
- **Dependency Diagram (`PUT /.../dependency-diagram-layout`)**: Uses Prisma's `upsert` operation, which is inherently idempotent (updates if exists, creates if not).

### 3. Identified Gaps
The following scenarios are currently susceptible to duplicate operations if a client retries a request due to a network timeout:
- **Task Comments**: Sending the same comment twice will result in two separate comment records.
- **Time Logs**: Logging time with the same duration and note multiple times.
- **Bulk Task Creation**: The `@everyone` assignee logic in `/tasks` could create multiple sets of tasks if the request is retried.

---

## Recommended Integration Strategy

If a robust, generic idempotency system is required, it should be integrated following these steps:

### 1. Database Schema Update
Add a dedicated model to track idempotency keys in `backend/prisma/schema.prisma`:

```prisma
model IdempotencyKey {
  id             String   @id @default(cuid())
  key            String   @unique
  userId         String
  responseStatus Int
  responseBody   Json
  createdAt      DateTime @default(now())
  expiresAt      DateTime

  @@index([userId, key])
}
```

### 2. Backend Middleware
Implement a middleware in `backend/src/middlewares/idempotency.ts` that:
1. Intercepts incoming `POST`, `PATCH`, and `DELETE` requests.
2. Checks for an `Idempotency-Key` header.
3. If the key exists in the database, returns the cached response immediately.
4. If not, proceeds with the request and caches the result before sending it to the client.

### 3. Frontend Global Configuration
Update the API client (likely in a shared utility or hook) to generate a unique UUID for every mutation request and include it in the headers:

```typescript
// Example frontend interceptor logic
const idempotencyKey = crypto.randomUUID();
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Idempotency-Key': idempotencyKey,
    // ...other headers
  },
  body: JSON.stringify(data),
});
```

### 4. Critical Routes to Protect
Priority should be given to these routes:
- `POST /tasks` (especially bulk creation)
- `POST /tasks/:id/comments`
- `POST /time-logs`
- `POST /projects`
