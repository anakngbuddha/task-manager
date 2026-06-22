import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { upsertKnowledgeVector, deleteKnowledgeVector } from './rag.service.js'
import {
  validateKnowledgeUpdate,
  buildConfirmationMessage,
  type KnowledgeValidationResult,
} from './knowledgeGuard.service.js'

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
