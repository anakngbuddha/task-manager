/*
  Warnings:

  - The values [OWNER,ADMIN] on the enum `ProjectMember_role` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `projectmember` MODIFY `role` ENUM('MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER') NOT NULL DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE `task` ADD COLUMN `deadline` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `ProjectInvite` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `acceptedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProjectInvite_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProjectInvite` ADD CONSTRAINT `ProjectInvite_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectInvite` ADD CONSTRAINT `ProjectInvite_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectInvite` ADD CONSTRAINT `ProjectInvite_acceptedById_fkey` FOREIGN KEY (`acceptedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
