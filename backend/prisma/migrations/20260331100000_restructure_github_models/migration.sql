-- DropForeignKey
ALTER TABLE `repoevent` DROP FOREIGN KEY `RepoEvent_taskId_fkey`;

-- DropTable
DROP TABLE `taskrepository`;

-- DropIndex
DROP INDEX `RepoEvent_taskId_createdAt_idx` ON `repoevent`;

-- AlterTable: RepoEvent
ALTER TABLE `repoevent` DROP COLUMN `taskId`,
    ADD COLUMN `message` TEXT NULL,
    ADD COLUMN `projectId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `RepoEvent_projectId_createdAt_idx` ON `repoevent`(`projectId`, `createdAt`);

-- AddForeignKey
ALTER TABLE `repoevent` ADD CONSTRAINT `RepoEvent_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `TaskGithubLink` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `status` VARCHAR(191) NULL,
    `author` VARCHAR(191) NULL,
    `number` INTEGER NULL,
    `sha` VARCHAR(191) NULL,
    `repoFullName` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TaskGithubLink_taskId_url_key`(`taskId`, `url`),
    INDEX `TaskGithubLink_taskId_idx`(`taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TaskGithubLink` ADD CONSTRAINT `TaskGithubLink_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
