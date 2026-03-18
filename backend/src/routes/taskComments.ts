import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middlewares/authenticate.js'
import { taskCommentService } from '../services/taskComment.service.js'
import { activityService } from '../services/activity.service.js'
import { prisma } from '../lib/prisma.js'

const createCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  parentId: z.string().optional(),
})

export async function taskCommentRoutes(app: FastifyInstance) {
  app.get('/tasks/:taskId/comments', { preHandler: authenticate }, async (req) => {
    const { taskId } = req.params as { taskId: string }
    return taskCommentService.listForTask(taskId)
  })

  app.post('/tasks/:taskId/comments', { preHandler: authenticate }, async (req) => {
    const { taskId } = req.params as { taskId: string }
    const body = createCommentSchema.parse(req.body)

    const created = await taskCommentService.create({
      taskId,
      authorId: req.authUser.id,
      content: body.content,
      parentId: body.parentId,
    })

    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true, title: true } })
    if (task) {
      await activityService.record({
        projectId: task.projectId,
        actorId: req.authUser.id,
        type: body.parentId ? 'TASK_COMMENT_REPLIED' : 'TASK_COMMENT_ADDED',
        entityType: 'TASK',
        entityId: taskId,
        metadata: { taskTitle: task.title },
      })
    }

    return created
  })
}

