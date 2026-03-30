/*
  Warnings:

  - Added the required column `updatedAt` to the `Sprint` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `sprint` DROP FOREIGN KEY `Sprint_projectId_fkey`;

-- DropIndex
DROP INDEX `Sprint_projectId_startDate_idx` ON `sprint`;

-- AlterTable
ALTER TABLE `sprint` ADD COLUMN `completedAt` DATETIME(3) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `startDate` DATETIME(3) NULL,
    MODIFY `endDate` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `task` ADD COLUMN `completedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Sprint_projectId_idx` ON `Sprint`(`projectId`);

-- CreateIndex
CREATE INDEX `Sprint_projectId_status_idx` ON `Sprint`(`projectId`, `status`);

