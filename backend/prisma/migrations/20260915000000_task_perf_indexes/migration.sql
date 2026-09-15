-- Composite indexes on Task matching the query shapes the application actually
-- runs. Single-column indexes on the foreign keys (projectId, assigneeId,
-- sprintId, parentId) already exist: InnoDB creates one automatically for every
-- foreign key constraint, so adding those would be redundant.
--
-- Task_projectId_idx remains in place. It is now a redundant prefix of the
-- indexes below, but dropping an index is a separate and riskier change that
-- belongs in its own migration.

-- CreateIndex
-- Board column grouping and every DONE_STATUSES filter.
CREATE INDEX `Task_projectId_status_idx` ON `Task`(`projectId`, `status`);

-- CreateIndex
-- Sprint backlog and sprint report queries.
CREATE INDEX `Task_projectId_sprintId_idx` ON `Task`(`projectId`, `sprintId`);

-- CreateIndex
-- Keyset pagination ordering in taskService.getPage(). Without this, paged
-- reads degrade to a filesort across the whole project.
CREATE INDEX `Task_projectId_createdAt_idx` ON `Task`(`projectId`, `createdAt`);
