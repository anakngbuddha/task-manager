import { prisma } from '../lib/prisma.js';
import { randomUUID } from 'crypto';
const WIDGET_TYPES = [
    'velocity_chart',
    'burndown_chart',
    'workload_summary',
    'time_summary',
    'recent_activity',
    'task_stats',
];
function defaultLayout() {
    // 2-column grid: x in [0,1]. We use discrete grid units for x/y and w/h.
    return [
        {
            id: randomUUID(),
            type: 'task_stats',
            position: { x: 0, y: 0 },
            size: { w: 1, h: 2 },
        },
        {
            id: randomUUID(),
            type: 'recent_activity',
            position: { x: 1, y: 0 },
            size: { w: 1, h: 1 },
        },
        {
            id: randomUUID(),
            type: 'workload_summary',
            position: { x: 1, y: 1 },
            size: { w: 1, h: 1 },
        },
    ];
}
export const dashboardLayoutService = {
    async getOrCreateLayout(userId, projectId) {
        try {
            const rows = await prisma.$queryRaw `
        SELECT layout
        FROM dashboard_layouts
        WHERE userId = ${userId} AND projectId = ${projectId}
        LIMIT 1
      `;
            const existingLayout = rows?.[0]?.layout;
            if (existingLayout) {
                if (typeof existingLayout === 'string')
                    return JSON.parse(existingLayout);
                return existingLayout;
            }
            const layout = defaultLayout();
            await prisma.$executeRaw `
        INSERT INTO dashboard_layouts (id, userId, projectId, layout, updatedAt)
        VALUES (${randomUUID()}, ${userId}, ${projectId}, ${JSON.stringify(layout)}, NOW())
      `;
            return layout;
        }
        catch (err) {
            const msg = String(err?.message ?? '');
            if (msg.includes("doesn't exist") || msg.includes('Unknown column') || msg.includes('no such table')) {
                return defaultLayout();
            }
            throw err;
        }
    },
    async updateLayout(userId, projectId, layout) {
        try {
            await prisma.$executeRaw `
        INSERT INTO dashboard_layouts (id, userId, projectId, layout, updatedAt)
        VALUES (${randomUUID()}, ${userId}, ${projectId}, ${JSON.stringify(layout)}, NOW())
        ON DUPLICATE KEY UPDATE
          layout = VALUES(layout),
          updatedAt = NOW()
      `;
        }
        catch (err) {
            const msg = String(err?.message ?? '');
            if (msg.includes("doesn't exist") || msg.includes('Unknown column') || msg.includes('no such table')) {
                // Table not migrated yet — ignore safely
            }
            else {
                throw err;
            }
        }
        return layout;
    },
};
export { WIDGET_TYPES };
