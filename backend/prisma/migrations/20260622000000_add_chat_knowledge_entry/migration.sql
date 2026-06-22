-- CreateTable
CREATE TABLE `ChatKnowledgeEntry` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `fact` TEXT NOT NULL,
    `scope` ENUM('USER', 'GLOBAL') NOT NULL,
    `status` ENUM('APPROVED', 'PENDING', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `category` VARCHAR(191) NULL,
    `rejectionReason` TEXT NULL,
    `sourceMessage` TEXT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `pineconeId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ChatKnowledgeEntry_userId_scope_status_idx`(`userId`, `scope`, `status`),
    INDEX `ChatKnowledgeEntry_scope_status_createdAt_idx`(`scope`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChatKnowledgeEntry` ADD CONSTRAINT `ChatKnowledgeEntry_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatKnowledgeEntry` ADD CONSTRAINT `ChatKnowledgeEntry_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
