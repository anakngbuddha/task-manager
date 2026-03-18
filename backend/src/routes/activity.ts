import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middlewares/authenticate.js'
import { activityService } from '../services/activity.service.js'

const listSchema = z.object({
  take: z.coerce.number().min(1).max(200).optional(),
})

export async function activityRoutes(app: FastifyInstance) {
  app.get('/activity', { preHandler: authenticate }, async (req) => {
    const { take } = listSchema.parse((req.query ?? {}) as any)
    return activityService.listForUser(req.authUser.id, { take })
  })

  app.get('/projects/:projectId/activity', { preHandler: authenticate }, async (req) => {
    const { projectId } = req.params as { projectId: string }
    const { take } = listSchema.parse((req.query ?? {}) as any)
    return activityService.listForProject(projectId, { take })
  })
}

