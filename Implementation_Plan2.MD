# AI Tester Role & Custom Knowledge — Implementation Plan v3
**Status:** Ready for Engineering Review  
**Version:** 3.0 (Polished & Corrected)

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Brutally Honest Critiques of v2](#2-brutally-honest-critiques-of-v2)
3. [Prerequisites & Dependencies](#3-prerequisites--dependencies)
4. [Role & Permission Matrix](#4-role--permission-matrix)
5. [Command Reference](#5-command-reference)
6. [Database Schema Changes](#6-database-schema-changes)
7. [Backend API Changes](#7-backend-api-changes)
8. [Service Layer Changes](#8-service-layer-changes)
9. [Security & Validation Rules](#9-security--validation-rules)
10. [Error Codes & User-Facing Messages](#10-error-codes--user-facing-messages)

---

## 1. Executive Summary

This plan introduces a new `AI_TESTER` role (capped at 5 users) that can suggest **global** knowledge without going through the AI validator. It adds chat slash-commands (`/add`, `/delete`, `/update`) so that authorized users can manage knowledge explicitly, and tightens the implicit-learning guard so normal users can never pollute global memory.

---

## 2. Brutally Honest Critiques of v2

Your v2 plan was a great start but had some critical flaws that would have broken production:

1. **You broke the existing schema:** You tried to make `userId` nullable and add a new `createdBy` field. The current app uses `userId` as the owner/creator for *both* `USER` and `GLOBAL` scopes. Changing this would break `knowledge.service.ts` and `adminKnowledge.ts`. **Fix:** We will keep `userId` as the creator and simply add the `name` field.
2. **Your Prisma lock wouldn't work:** `tx.user.count()` in Prisma does **not** lock rows. Your proposed `FOR UPDATE` transaction was an illusion. **Fix:** We must use `$queryRaw` to actually lock rows if we want strict concurrency control.
3. **You completely forgot Pinecone (Vector DB):** Global knowledge entries are synced to Pinecone via `upsertKnowledgeVector`. Your v2 plan ignored this, meaning AI Testers would add knowledge to MySQL, but the AI would never actually read it. **Fix:** Added Pinecone synchronization to the service layer requirements.
4. **You hallucinated Fastify `next()`:** The `chat.ts` route is an async function, not an Express middleware chain. There is no `next()` to call. **Fix:** The interceptor is just an early `return` block.
5. **You reinvented existing Admin routes:** You proposed adding `PATCH /admin/knowledge/...` endpoints, but `POST /admin/knowledge/:id/approve` endpoints *already exist* in `adminKnowledge.ts`. **Fix:** We will reuse the existing endpoints.
6. **Awkward Command Syntax:** `/delete-<name>` is terrible UX. Standard chat bots use `/delete <name>`. **Fix:** Updated the syntax to use spaces.

---

## 3. Prerequisites & Dependencies

- [ ] Database user running migrations has `ALTER TABLE` privileges.
- [ ] Feature flag system is in place (this change should ship behind a `FEATURE_AI_TESTER` flag).
- [ ] Admin dashboard source is accessible to the frontend team.

---

## 4. Role & Permission Matrix

| Action | USER | AI_TESTER | ADMIN |
|--------|------|-----------|-------|
| `/add <name> <fact>` | Personal scope, auto-approved | Global scope, **PENDING** | Global scope, auto-approved |
| `/delete <name>` (own entries) | ✅ Own personal entries only | ✅ Own personal + any global PENDING | ✅ All entries |
| `/delete <name>` (others' entries) | ❌ | ❌ | ✅ |
| `/update <name> <new fact>` | ✅ Own personal entries only | ✅ Own personal + any global PENDING | ✅ All entries |
| Implicit AI learning → personal | ✅ | ✅ | ✅ |
| Implicit AI learning → global | ❌ Never | ❌ Never (use `/add`) | ✅ |
| Approve/reject PENDING knowledge| ❌ | ❌ | ✅ |
| Assign AI_TESTER role | ❌ | ❌ | ✅ (max 5 total) |

---

## 5. Command Reference

### Syntax Rules
- `<name>` must match `^[a-z0-9][a-z0-9\-_]{0,63}$` — starts with alphanumeric, max 64 chars.
- Commands are only recognized when the **entire** message starts with `/`.

### Supported Commands

```
/add <name> <fact>
  Add a new knowledge entry named <name>. 
  If <name> exists in the same scope, returns error.

/delete <name>
  Delete the knowledge entry identified by <name>.

/update <name> <new fact>
  Replace the fact for entry <name>.
  If the entry is APPROVED and a non-admin updates it, it reverts to PENDING.

/knowledge-list
  Lists all accessible knowledge entries.
```

---

## 6. Database Schema Changes

### File: `backend/prisma/schema.prisma`

#### 6.1 Update `SystemRole` enum

```prisma
enum SystemRole {
  USER   @map("user")
  ADMIN  @map("admin")
  AI_TESTER @map("ai_tester") // NEW
  BANNED @map("banned")
}
```

#### 6.2 Add `name` to `ChatKnowledgeEntry`

```prisma
model ChatKnowledgeEntry {
  id              String          @id @default(cuid())
  userId          String          // Represents the creator/owner
  name            String?         // slug identifier, e.g. "sky-color". Nullable for old entries.
  fact            String          @db.Text
  scope           KnowledgeScope
  status          KnowledgeStatus @default(PENDING)
  // ... existing fields ...

  // Uniqueness: name must be unique per user. For GLOBAL, uniqueness can be enforced in code.
  @@unique([name, userId])
}
```

> ⚠️ **Backfill script required:** Run a script to auto-generate `name` for existing entries before making the column required in a future migration. For now, it is nullable `String?` to prevent migration failures.

---

## 7. Backend API Changes

### 7.1 Admin Role Assignment
**File:** `backend/src/routes/admin.routes.ts`

Endpoint: `PATCH /admin/users/:id/role`

**Concurrency safe assignment using raw SQL:**
```typescript
await prisma.$transaction(async (tx) => {
  // Use raw SQL to actually lock the rows if strict concurrency is needed
  const testers: any[] = await tx.$queryRaw`SELECT id FROM User WHERE role = 'ai_tester' FOR UPDATE`;
  
  if (testers.length >= 5 && role === 'AI_TESTER') {
    throw new AppError('AI_TESTER_CAP_REACHED', 409);
  }
  
  return tx.user.update({
    where: { id: userId },
    data: { role }
  });
});
```

### 7.2 Chat Message Interception
**File:** `backend/src/routes/chat.ts`

Add an early `if` block inside the `POST /chat` handler:
```typescript
if (message.startsWith('/')) {
  if (message.startsWith('/add ')) {
     const response = await addDirectKnowledge(req.authUser, message);
     return reply.send({ message: response });
  } else if (message.startsWith('/delete ')) {
     // handle delete
  }
  // ...
  return reply.status(400).send({ error: "UNKNOWN_COMMAND" });
}
```

---

## 8. Service Layer Changes

### 8.1 `knowledge.service.ts`

We need dedicated functions for direct commands. **Crucially, these must interact with Pinecone.**

- `addDirectKnowledge`: Validates name/fact. Determines scope/status based on role. Saves to MySQL. **If scope is GLOBAL and status is APPROVED (Admin), call `upsertKnowledgeVector()`.**
- `deleteKnowledgeByName`: Finds the entry. If it has a `pineconeId`, call `deleteKnowledgeVector()`. Deletes from MySQL.
- `updateKnowledgeByName`: Updates the entry in MySQL. If the status reverts to PENDING, call `deleteKnowledgeVector()` to remove it from live AI context until re-approved. If it remains APPROVED, call `upsertKnowledgeVector()` to update the vector.

### 8.2 `knowledgeGuard.service.ts`
In `validateKnowledgeUpdate`, prevent normal users from triggering global knowledge:
```typescript
if (!isAdmin && userRole !== SystemRole.AI_TESTER) {
  // Silently downgrade LLM queue_global decisions for normal users
  if (llmResult.verdict === 'queue_global') {
    llmResult.verdict = 'approve_user';
  }
}
```

---

## 9. Security & Validation Rules
- **Regex Slug Validation:** `/^[a-z0-9][a-z0-9\-_]{0,63}$/`
- **Rate Limiting:** Ensure the chat endpoint rate limit covers these commands to prevent database/Pinecone spam.

---

## 10. Error Codes & User-Facing Messages
- `UNKNOWN_COMMAND`: "I don't recognize that command."
- `INVALID_NAME`: "The name is invalid. Use only lowercase letters, numbers, hyphens, and underscores."
- `KNOWLEDGE_NAME_EXISTS`: "A knowledge entry with this name already exists."
- `KNOWLEDGE_NOT_FOUND`: "No knowledge entry found with that name."
- `AI_TESTER_CAP_REACHED`: "The maximum number of AI Tester accounts (5) has been reached."