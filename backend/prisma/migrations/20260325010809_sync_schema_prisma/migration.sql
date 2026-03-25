/*
  Warnings:

  - You are about to alter the column `status` on the `task` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(1))` to `VarChar(191)`.

*/
-- DropForeignKey
ALTER TABLE `projectinvite` DROP FOREIGN KEY `ProjectInvite_projectId_fkey`;

-- DropForeignKey
ALTER TABLE `projectmember` DROP FOREIGN KEY `ProjectMember_projectId_fkey`;

-- DropForeignKey
ALTER TABLE `task` DROP FOREIGN KEY `Task_projectId_fkey`;

-- DropIndex
DROP INDEX `ProjectInvite_projectId_fkey` ON `projectinvite`;

-- DropIndex
DROP INDEX `ProjectMember_projectId_fkey` ON `projectmember`;

-- AlterTable
ALTER TABLE `project` ADD COLUMN `boardColumns` JSON NOT NULL,
    ADD COLUMN `status` ENUM('ACTIVE', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE `task` ADD COLUMN `deadlineReminderSent` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `githubPrUrl` VARCHAR(191) NULL,
    ADD COLUMN `sprintId` VARCHAR(191) NULL,
    ADD COLUMN `startDate` DATETIME(3) NULL,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'TODO';

-- AlterTable
ALTER TABLE `user` ADD COLUMN `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `status` ENUM('ONLINE', 'WORKING', 'BUSY', 'AWAY', 'IN_MEETING', 'OFFLINE') NOT NULL DEFAULT 'ONLINE';

-- AlterTable
ALTER TABLE `verification` MODIFY `value` VARCHAR(512) NOT NULL;

-- CreateTable
CREATE TABLE `TaskDependency` (
    `id` VARCHAR(191) NOT NULL,
    `blockingTaskId` VARCHAR(191) NOT NULL,
    `blockedTaskId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'BLOCKS',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaskDependency_blockedTaskId_idx`(`blockedTaskId`),
    UNIQUE INDEX `TaskDependency_blockingTaskId_blockedTaskId_key`(`blockingTaskId`, `blockedTaskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskComment` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `content` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TaskComment_taskId_idx`(`taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectMessage` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProjectMessage_projectId_createdAt_idx`(`projectId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectDirectMessage` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `recipientId` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProjectDirectMessage_projectId_senderId_createdAt_idx`(`projectId`, `senderId`, `createdAt`),
    INDEX `ProjectDirectMessage_projectId_recipientId_createdAt_idx`(`projectId`, `recipientId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivityEvent` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityEvent_projectId_createdAt_idx`(`projectId`, `createdAt`),
    INDEX `ActivityEvent_actorId_createdAt_idx`(`actorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NULL,
    `href` VARCHAR(191) NOT NULL,
    `data` JSON NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `Notification_userId_readAt_idx`(`userId`, `readAt`),
    INDEX `Notification_projectId_createdAt_idx`(`projectId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectChatReadState` (
    `projectId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `lastReadAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`projectId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DirectChatReadState` (
    `projectId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `otherUserId` VARCHAR(191) NOT NULL,
    `lastReadAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DirectChatReadState_projectId_otherUserId_userId_idx`(`projectId`, `otherUserId`, `userId`),
    PRIMARY KEY (`projectId`, `userId`, `otherUserId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sprint` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `goal` TEXT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `status` ENUM('PLANNING', 'ACTIVE', 'COMPLETED') NOT NULL DEFAULT 'PLANNING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Sprint_projectId_startDate_idx`(`projectId`, `startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TimeLog` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `durationMinutes` INTEGER NOT NULL,
    `note` VARCHAR(191) NULL,
    `loggedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TimeLog_taskId_loggedAt_idx`(`taskId`, `loggedAt`),
    INDEX `TimeLog_userId_loggedAt_idx`(`userId`, `loggedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dashboard_layouts` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `layout` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `dashboard_layouts_projectId_updatedAt_idx`(`projectId`, `updatedAt`),
    UNIQUE INDEX `dashboard_layouts_userId_projectId_key`(`userId`, `projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GithubInstallation` (
    `id` VARCHAR(191) NOT NULL,
    `installationId` INTEGER NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `repos` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GithubInstallation_installationId_key`(`installationId`),
    INDEX `GithubInstallation_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GithubRepository` (
    `id` VARCHAR(191) NOT NULL,
    `installationId` VARCHAR(191) NOT NULL,
    `repoFullName` VARCHAR(191) NOT NULL,
    `repoId` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `GithubRepository_installationId_repoFullName_key`(`installationId`, `repoFullName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Schedule` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `type` ENUM('MEETING', 'TRAINING', 'REVIEW', 'REMINDER', 'OTHER') NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `details` VARCHAR(2000) NULL,
    `location` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `creatorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Schedule_creatorId_scheduledAt_idx`(`creatorId`, `scheduledAt`),
    INDEX `Schedule_projectId_scheduledAt_idx`(`projectId`, `scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduleAttendee` (
    `id` VARCHAR(191) NOT NULL,
    `scheduleId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,

    UNIQUE INDEX `ScheduleAttendee_scheduleId_email_key`(`scheduleId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduleNotificationLog` (
    `id` VARCHAR(191) NOT NULL,
    `scheduleId` VARCHAR(191) NULL,
    `taskId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('SCHEDULE_1DAY', 'SCHEDULE_15MIN', 'TASK_DEADLINE_1DAY', 'TASK_DEADLINE_15MIN') NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ScheduleNotificationLog_scheduleId_idx`(`scheduleId`),
    INDEX `ScheduleNotificationLog_taskId_idx`(`taskId`),
    UNIQUE INDEX `ScheduleNotificationLog_scheduleId_userId_type_key`(`scheduleId`, `userId`, `type`),
    UNIQUE INDEX `ScheduleNotificationLog_taskId_userId_type_key`(`taskId`, `userId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_sprintId_fkey` FOREIGN KEY (`sprintId`) REFERENCES `Sprint`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskDependency` ADD CONSTRAINT `TaskDependency_blockingTaskId_fkey` FOREIGN KEY (`blockingTaskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskDependency` ADD CONSTRAINT `TaskDependency_blockedTaskId_fkey` FOREIGN KEY (`blockedTaskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectInvite` ADD CONSTRAINT `ProjectInvite_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskComment` ADD CONSTRAINT `TaskComment_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskComment` ADD CONSTRAINT `TaskComment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskComment` ADD CONSTRAINT `TaskComment_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `TaskComment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMessage` ADD CONSTRAINT `ProjectMessage_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMessage` ADD CONSTRAINT `ProjectMessage_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectDirectMessage` ADD CONSTRAINT `ProjectDirectMessage_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectDirectMessage` ADD CONSTRAINT `ProjectDirectMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectDirectMessage` ADD CONSTRAINT `ProjectDirectMessage_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityEvent` ADD CONSTRAINT `ActivityEvent_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityEvent` ADD CONSTRAINT `ActivityEvent_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectChatReadState` ADD CONSTRAINT `ProjectChatReadState_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectChatReadState` ADD CONSTRAINT `ProjectChatReadState_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DirectChatReadState` ADD CONSTRAINT `DirectChatReadState_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DirectChatReadState` ADD CONSTRAINT `DirectChatReadState_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sprint` ADD CONSTRAINT `Sprint_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimeLog` ADD CONSTRAINT `TimeLog_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimeLog` ADD CONSTRAINT `TimeLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dashboard_layouts` ADD CONSTRAINT `dashboard_layouts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dashboard_layouts` ADD CONSTRAINT `dashboard_layouts_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GithubInstallation` ADD CONSTRAINT `GithubInstallation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GithubInstallation` ADD CONSTRAINT `GithubInstallation_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GithubRepository` ADD CONSTRAINT `GithubRepository_installationId_fkey` FOREIGN KEY (`installationId`) REFERENCES `GithubInstallation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Schedule` ADD CONSTRAINT `Schedule_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Schedule` ADD CONSTRAINT `Schedule_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleAttendee` ADD CONSTRAINT `ScheduleAttendee_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `Schedule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleNotificationLog` ADD CONSTRAINT `ScheduleNotificationLog_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `Schedule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleNotificationLog` ADD CONSTRAINT `ScheduleNotificationLog_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleNotificationLog` ADD CONSTRAINT `ScheduleNotificationLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma emitted DROP INDEX `Task_*_fkey` here, but MySQL ties those names to foreign keys;
-- the FKs `Task_assigneeId_fkey` / `Task_projectId_fkey` already index those columns.
-- Add only the explicit @@index names from the schema (safe if index already exists — skip errors in manual repair).
CREATE INDEX `Task_assigneeId_idx` ON `Task`(`assigneeId`);
CREATE INDEX `Task_projectId_idx` ON `Task`(`projectId`);
