import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { upsertKnowledgeVector, deleteKnowledgeVector } from './rag.service.js'
import {
  validateKnowledgeUpdate,
  buildConfirmationMessage,
  validateDirectFact,
  type KnowledgeValidationResult,
} from './knowledgeGuard.service.js'
import { notificationService } from './notification.service.js'

export async function loadPersonalMemory(userId: string): Promise<string[]> {
  try {
    const entries = await prisma.chatKnowledgeEntry.findMany({
      where: { userId, scope: 'USER', status: 'APPROVED' },
      orderBy: { createdAt: 'asc' },
      select: { fact: true },
      take: 50,
    })
    return entries.map(e => e.fact)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') {
      console.warn('ChatKnowledgeEntry table missing — run: npm run db:migrate:deploy')
      return []
    }
    throw err
  }
}

export async function persistKnowledgeUpdate(params: {
  fact: string
  sourceMessage: string
  userId: string
  isAdmin: boolean
  userRole?: string
}): Promise<{ message: string; validation: KnowledgeValidationResult }> {
  const validation = await validateKnowledgeUpdate(params)

  if (validation.verdict === 'reject') {
    return {
      message: buildConfirmationMessage(validation, params.isAdmin),
      validation,
    }
  }

  if (validation.verdict === 'approve_user') {
    await prisma.chatKnowledgeEntry.create({
      data: {
        userId: params.userId,
        fact: validation.sanitizedFact,
        scope: 'USER',
        status: 'APPROVED',
        category: validation.category,
        sourceMessage: params.sourceMessage,
      },
    })
  }

  if (validation.verdict === 'queue_global') {
    await prisma.chatKnowledgeEntry.create({
      data: {
        userId: params.userId,
        fact: validation.sanitizedFact,
        scope: 'USER',
        status: 'APPROVED',
        category: validation.category,
        sourceMessage: params.sourceMessage,
      },
    })

    if (params.isAdmin) {
      const globalEntry = await prisma.chatKnowledgeEntry.create({
        data: {
          userId: params.userId,
          fact: validation.sanitizedFact,
          scope: 'GLOBAL',
          status: 'APPROVED',
          category: validation.category,
          sourceMessage: params.sourceMessage,
          reviewedById: params.userId,
          reviewedAt: new Date(),
        },
      })

      const pineconeId = await upsertKnowledgeVector(globalEntry.id, validation.sanitizedFact)
      if (pineconeId) {
        await prisma.chatKnowledgeEntry.update({
          where: { id: globalEntry.id },
          data: { pineconeId },
        })
      }
    } else {
      await prisma.chatKnowledgeEntry.create({
        data: {
          userId: params.userId,
          fact: validation.sanitizedFact,
          scope: 'GLOBAL',
          status: 'PENDING',
          category: validation.category,
          sourceMessage: params.sourceMessage,
        },
      })
    }
  }

  return {
    message: buildConfirmationMessage(validation, params.isAdmin),
    validation,
  }
}

export async function approveGlobalKnowledge(entryId: string, adminUserId: string): Promise<void> {
  const entry = await prisma.chatKnowledgeEntry.findUnique({ where: { id: entryId } })
  if (!entry || entry.scope !== 'GLOBAL' || entry.status !== 'PENDING') {
    throw new Error('Entry not found or not pending')
  }

  const pineconeId = await upsertKnowledgeVector(entry.id, entry.fact)
  await prisma.chatKnowledgeEntry.update({
    where: { id: entryId },
    data: {
      status: 'APPROVED',
      reviewedById: adminUserId,
      reviewedAt: new Date(),
      pineconeId,
    },
  })
}

export async function rejectGlobalKnowledge(
  entryId: string,
  adminUserId: string,
  reason: string,
): Promise<void> {
  const entry = await prisma.chatKnowledgeEntry.findUnique({ where: { id: entryId } })
  if (!entry || entry.scope !== 'GLOBAL' || entry.status !== 'PENDING') {
    throw new Error('Entry not found or not pending')
  }

  await prisma.chatKnowledgeEntry.update({
    where: { id: entryId },
    data: {
      status: 'REJECTED',
      rejectionReason: reason,
      reviewedById: adminUserId,
      reviewedAt: new Date(),
    },
  })
}

export async function revokeGlobalKnowledge(entryId: string): Promise<void> {
  const entry = await prisma.chatKnowledgeEntry.findUnique({ where: { id: entryId } })
  if (!entry || entry.scope !== 'GLOBAL' || entry.status !== 'APPROVED') {
    throw new Error('Entry not found or not approved')
  }

  if (entry.pineconeId) {
    await deleteKnowledgeVector(entry.pineconeId)
  }

  await prisma.chatKnowledgeEntry.delete({ where: { id: entryId } })
}

export interface KnowledgeActor {
  userId: string
  role: string
}

async function notifyAdminsOfPendingKnowledge(entryName: string): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  })

  await Promise.all(
    admins.map((admin) =>
      notificationService
        .create({
          userId: admin.id,
          type: 'KNOWLEDGE_PENDING',
          title: 'Global knowledge pending review',
          body: `AI Tester submitted "${entryName}" for admin approval.`,
          href: '/admin/knowledge',
        })
        .catch(() => undefined),
    ),
  )
}

function entryWhereForActor(actor: KnowledgeActor, name: string) {
  if (actor.role === 'ADMIN') {
    return { name, scope: 'GLOBAL' as const }
  }
  return { name, userId: actor.userId }
}

function assertCanMutateEntry(actor: KnowledgeActor, entry: { userId: string; scope: string; status: string }) {
  if (actor.role === 'ADMIN') return

  if (entry.userId !== actor.userId) {
    throw new Error('KNOWLEDGE_NOT_FOUND')
  }

  if (entry.scope === 'GLOBAL' && entry.status === 'APPROVED') {
    throw new Error('KNOWLEDGE_NOT_FOUND')
  }
}

export async function addDirectKnowledge(
  actor: KnowledgeActor,
  name: string,
  fact: string,
): Promise<any> {
  const isAdmin = actor.role === 'ADMIN'
  const sanitizedFact = validateDirectFact(fact, {
    isAdmin,
    sourceMessage: `/add ${name} ${fact}`,
  })

  const scope = actor.role === 'ADMIN' || actor.role === 'AI_TESTER' ? 'GLOBAL' : 'USER'
  const status = actor.role === 'AI_TESTER' ? 'PENDING' : 'APPROVED'

  try {
    const entry = await prisma.$transaction(async (tx) => {
      if (scope === 'GLOBAL') {
        const existingGlobal = await tx.chatKnowledgeEntry.findFirst({
          where: {
            name,
            scope: 'GLOBAL',
            status: { in: ['APPROVED', 'PENDING'] },
          },
        })
        if (existingGlobal) {
          throw new Error('KNOWLEDGE_NAME_EXISTS')
        }
      }

      return tx.chatKnowledgeEntry.create({
        data: {
          userId: actor.userId,
          name,
          fact: sanitizedFact,
          scope,
          status,
          sourceMessage: `/add ${name} ${sanitizedFact}`,
        },
      })
    })

    if (scope === 'GLOBAL' && status === 'APPROVED') {
      const pineconeId = await upsertKnowledgeVector(entry.id, sanitizedFact)
      if (pineconeId) {
        await prisma.chatKnowledgeEntry.update({
          where: { id: entry.id },
          data: { pineconeId },
        })
      }
    }

    if (scope === 'GLOBAL' && status === 'PENDING' && actor.role === 'AI_TESTER') {
      void notifyAdminsOfPendingKnowledge(name)
    }

    return entry
  } catch (err: any) {
    if (err instanceof Error && err.message === 'KNOWLEDGE_NAME_EXISTS') {
      throw err
    }
    if (err.code === 'P2002') {
      throw new Error('KNOWLEDGE_NAME_EXISTS')
    }
    throw err
  }
}

export async function deleteKnowledgeByName(
  actor: KnowledgeActor,
  name: string,
): Promise<void> {
  const entry = await prisma.chatKnowledgeEntry.findFirst({
    where: entryWhereForActor(actor, name),
  })

  if (!entry) {
    throw new Error('KNOWLEDGE_NOT_FOUND')
  }

  assertCanMutateEntry(actor, entry)

  if (entry.pineconeId) {
    await deleteKnowledgeVector(entry.pineconeId)
  }

  await prisma.chatKnowledgeEntry.delete({ where: { id: entry.id } })
}

export async function updateKnowledgeByName(
  actor: KnowledgeActor,
  name: string,
  newFact: string,
): Promise<any> {
  const entry = await prisma.chatKnowledgeEntry.findFirst({
    where: entryWhereForActor(actor, name),
  })

  if (!entry) {
    throw new Error('KNOWLEDGE_NOT_FOUND')
  }

  assertCanMutateEntry(actor, entry)

  const isAdmin = actor.role === 'ADMIN'
  const sanitizedFact = validateDirectFact(newFact, {
    isAdmin,
    sourceMessage: `/update ${name} ${newFact}`,
  })

  const newStatus =
    entry.status === 'APPROVED' && actor.role !== 'ADMIN' && entry.scope === 'GLOBAL'
      ? 'PENDING'
      : entry.status

  const updated = await prisma.chatKnowledgeEntry.update({
    where: { id: entry.id },
    data: {
      fact: sanitizedFact,
      status: newStatus,
    },
  })

  if (newStatus === 'PENDING' && entry.pineconeId) {
    await deleteKnowledgeVector(entry.pineconeId)
    await prisma.chatKnowledgeEntry.update({
      where: { id: entry.id },
      data: { pineconeId: null },
    })
  } else if (newStatus === 'APPROVED' && entry.scope === 'GLOBAL') {
    const pineconeId = await upsertKnowledgeVector(entry.id, sanitizedFact)
    if (pineconeId) {
      await prisma.chatKnowledgeEntry.update({
        where: { id: entry.id },
        data: { pineconeId },
      })
    }
  }

  return updated
}
