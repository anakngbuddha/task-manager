-- AlterTable
ALTER TABLE `projectdirectmessage` ADD COLUMN `fileName` VARCHAR(191) NULL,
    ADD COLUMN `fileUrl` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `projectmessage` ADD COLUMN `fileName` VARCHAR(191) NULL,
    ADD COLUMN `fileUrl` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `scheduleattendee` ADD COLUMN `response` ENUM('PENDING', 'ACCEPTED', 'DECLINED') NOT NULL DEFAULT 'PENDING';
