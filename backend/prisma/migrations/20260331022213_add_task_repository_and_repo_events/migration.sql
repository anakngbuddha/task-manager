-- CreateTable
CREATE TABLE `TaskRepository` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `repoId` VARCHAR(191) NOT NULL,
    `branchFilter` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaskRepository_repoId_idx`(`repoId`),
    UNIQUE INDEX `TaskRepository_taskId_repoId_key`(`taskId`, `repoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RepoEvent` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `repoId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `branch` VARCHAR(191) NULL,
    `sha` VARCHAR(191) NULL,
    `prNumber` INTEGER NULL,
    `prTitle` VARCHAR(191) NULL,
    `author` VARCHAR(191) NULL,
    `htmlUrl` VARCHAR(191) NULL,
    `summary` JSON NULL,
    `githubDeliveryId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RepoEvent_taskId_createdAt_idx`(`taskId`, `createdAt`),
    INDEX `RepoEvent_repoId_createdAt_idx`(`repoId`, `createdAt`),
    INDEX `RepoEvent_githubDeliveryId_idx`(`githubDeliveryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TaskRepository` ADD CONSTRAINT `TaskRepository_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskRepository` ADD CONSTRAINT `TaskRepository_repoId_fkey` FOREIGN KEY (`repoId`) REFERENCES `GithubRepository`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RepoEvent` ADD CONSTRAINT `RepoEvent_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RepoEvent` ADD CONSTRAINT `RepoEvent_repoId_fkey` FOREIGN KEY (`repoId`) REFERENCES `GithubRepository`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
