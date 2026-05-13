import { prisma } from '../lib/prisma.js';
const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'READY'];
const COMPLETED_STATUSES = ['DONE', 'READY'];
const FINISHED_PROJECT_STATUSES = new Set(['COMPLETED', 'AXED']);
const MS_PER_HOUR = 1000 * 60 * 60;
function countActiveMembers(projects) {
    const memberIds = new Set();
    for (const p of projects) {
        for (const m of p.members ?? []) {
            if (m?.userId)
                memberIds.add(m.userId);
        }
    }
    return memberIds.size;
}
function buildTaskStatusMaps(projectIds, statusCounts) {
    const statusMap = {};
    const totalMap = {};
    const doneMap = {};
    let totalTasksAll = 0;
    let completedTasksAll = 0;
    for (const pId of projectIds) {
        statusMap[pId] = TASK_STATUSES.reduce((acc, s) => { acc[s] = 0; return acc; }, {});
        totalMap[pId] = 0;
        doneMap[pId] = 0;
    }
    for (const row of statusCounts) {
        const status = row.status;
        const count = row._count._all;
        statusMap[row.projectId][status] = count;
        totalMap[row.projectId] += count;
        totalTasksAll += count;
        if (COMPLETED_STATUSES.includes(status)) {
            doneMap[row.projectId] += count;
            completedTasksAll += count;
        }
    }
    return { statusMap, totalMap, doneMap, totalTasksAll, completedTasksAll };
}
function calculateAverageCompletionHours(projectIds, doneTasks) {
    const acc = {};
    for (const pId of projectIds) {
        acc[pId] = { sumHours: 0, count: 0 };
    }
    for (const t of doneTasks) {
        const durationMs = t.updatedAt.getTime() - t.createdAt.getTime();
        if (durationMs <= 0)
            continue;
        acc[t.projectId].sumHours += durationMs / MS_PER_HOUR;
        acc[t.projectId].count += 1;
    }
    const result = {};
    for (const pId of projectIds) {
        result[pId] = acc[pId].count ? acc[pId].sumHours / acc[pId].count : null;
    }
    return result;
}
function mapProjectMembers(members) {
    return (members ?? [])
        .map((m) => m?.user)
        .filter(Boolean)
        .map((u) => ({ id: u.id, name: u.name, email: u.email, avatar: u.avatar }));
}
export const projectService = {
    async getDashboardForUser(userId) {
        const projects = await prisma.project.findMany({
            where: { members: { some: { userId } } },
            include: {
                members: {
                    select: {
                        userId: true,
                        user: { select: { id: true, name: true, email: true, avatar: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const projectIds = projects.map((p) => p.id);
        if (projectIds.length === 0) {
            return {
                totalProjects: 0, totalTasks: 0, completedTasks: 0,
                activeMembers: 0, finishedProjects: 0, finishedPercentage: 0, projects: [],
            };
        }
        const [statusCounts, doneTasks] = await Promise.all([
            prisma.task.groupBy({
                by: ['projectId', 'status'],
                where: { projectId: { in: projectIds } },
                _count: { _all: true },
            }),
            prisma.task.findMany({
                where: { projectId: { in: projectIds }, status: 'DONE' },
                select: { projectId: true, createdAt: true, updatedAt: true },
            }),
        ]);
        const activeMembers = countActiveMembers(projects);
        const { statusMap, totalMap, doneMap, totalTasksAll, completedTasksAll } = buildTaskStatusMaps(projectIds, statusCounts);
        const avgHoursMap = calculateAverageCompletionHours(projectIds, doneTasks);
        const computedProjects = projects.map((p) => {
            const totalTasks = totalMap[p.id] ?? 0;
            const doneTasksCount = doneMap[p.id] ?? 0;
            return {
                id: p.id,
                name: p.name,
                status: p.status,
                totalTasks,
                doneTasks: doneTasksCount,
                completionPct: totalTasks > 0 ? (doneTasksCount / totalTasks) * 100 : 0,
                isFinished: FINISHED_PROJECT_STATUSES.has(p.status),
                members: mapProjectMembers(p.members),
                taskCountsByStatus: statusMap[p.id],
                avgCompletionHours: avgHoursMap[p.id],
            };
        });
        const finishedProjectsCount = computedProjects.filter((p) => p.isFinished).length;
        return {
            totalProjects: computedProjects.length,
            totalTasks: totalTasksAll,
            completedTasks: completedTasksAll,
            activeMembers,
            finishedProjects: finishedProjectsCount,
            finishedPercentage: computedProjects.length
                ? (finishedProjectsCount / computedProjects.length) * 100
                : 0,
            projects: computedProjects,
        };
    },
    async getAllForUser(userId) {
        return prisma.project.findMany({
            where: {
                members: { some: { userId } },
                status: 'ACTIVE',
            },
            include: {
                members: { include: { user: true } },
                _count: { select: { tasks: true } },
            },
        });
    },
    async getArchivedForUser(userId) {
        return prisma.project.findMany({
            where: {
                members: { some: { userId } },
                status: { in: ['COMPLETED', 'AXED'] },
            },
            include: {
                members: { include: { user: true } },
                _count: { select: { tasks: true } },
            },
        });
    },
    async getById(id) {
        return prisma.project.findUnique({
            where: { id },
            include: {
                members: { include: { user: true } },
                tasks: { include: { assignee: true } },
            },
        });
    },
    async create(name, userId) {
        return prisma.project.create({
            data: {
                name,
                members: {
                    create: { userId, role: 'MASTER_ADMIN' },
                },
            },
            include: { members: true },
        });
    },
    async update(id, data) {
        return prisma.project.update({
            where: { id },
            data,
        });
    },
    async delete(id) {
        return prisma.project.delete({ where: { id } });
    },
    async addMember(projectId, userId) {
        return prisma.projectMember.create({
            data: { projectId, userId, role: 'MEMBER' },
        });
    },
    async listMembers(projectId) {
        return prisma.projectMember.findMany({
            where: { projectId },
            include: { user: true },
            orderBy: { role: 'asc' },
        });
    },
    async getMemberRole(projectId, userId) {
        return prisma.projectMember.findUnique({
            where: { userId_projectId: { userId, projectId } },
            select: { role: true },
        });
    },
    async updateMemberRole(projectId, userId, role) {
        return prisma.projectMember.update({
            where: { userId_projectId: { userId, projectId } },
            data: { role },
        });
    },
    async getPendingDeadlines(userId, daysAhead, daysBehind = 0, limit = 100, includeCompleted = false) {
        const now = new Date();
        const start = new Date(now.getTime() - daysBehind * 24 * 60 * 60 * 1000);
        const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
        const memberships = await prisma.projectMember.findMany({
            where: { userId },
            select: { projectId: true, project: { select: { id: true, name: true } } },
        });
        const projectIds = memberships.map((m) => m.projectId);
        if (projectIds.length === 0)
            return [];
        const projectMap = new Map(memberships.map((m) => [m.projectId, m.project]));
        const tasks = await prisma.task.findMany({
            where: {
                projectId: { in: projectIds },
                deadline: { gte: start, lte: end },
                ...(includeCompleted ? {} : { status: { notIn: ['DONE', 'READY'] } }),
            },
            select: { id: true, title: true, deadline: true, status: true, projectId: true, type: true },
            orderBy: { deadline: 'asc' },
            take: limit,
        });
        return tasks.map((t) => ({
            kind: 'DEADLINE',
            id: t.id,
            title: t.title,
            deadline: t.deadline.toISOString(),
            status: t.status,
            type: t.type,
            project: projectMap.get(t.projectId) ?? { id: t.projectId, name: '' },
        }));
    },
};
