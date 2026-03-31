-- AlterTable
ALTER TABLE `Project` ADD COLUMN `githubStatusMap` JSON NULL;

-- AlterTable
ALTER TABLE `GithubInstallation` MODIFY `projectId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ProjectRepository` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `repoId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProjectRepository_projectId_repoId_key`(`projectId`, `repoId`),
    INDEX `ProjectRepository_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProjectRepository` ADD CONSTRAINT `ProjectRepository_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectRepository` ADD CONSTRAINT `ProjectRepository_repoId_fkey` FOREIGN KEY (`repoId`) REFERENCES `GithubRepository`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `ProjectDependencyDiagramLayout` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `layout` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProjectDependencyDiagramLayout_projectId_key`(`projectId`),
    INDEX `ProjectDependencyDiagramLayout_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProjectDependencyDiagramLayout` ADD CONSTRAINT `ProjectDependencyDiagramLayout_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

