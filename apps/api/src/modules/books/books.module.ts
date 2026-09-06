import { BullModule } from "@nestjs/bullmq";
import { forwardRef, Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { AuthorsModule } from "../authors/index.js";
import { DeliveryModule } from "../delivery/index.js";
import { GenresModule } from "../genres/index.js";
import { ListsModule } from "../lists/index.js";
import { LoansModule } from "../loans/index.js";
import { MediaModule } from "../media/index.js";
import { ProfileModule } from "../profile/index.js";
import { PublishersModule } from "../publishers/index.js";
import { ReadingGoalsModule } from "../reading-goals/index.js";
import { SeriesModule } from "../series/index.js";
import { TagsModule } from "../tags/index.js";
import { BookDeliveryController } from "./api/book-delivery.controller.js";
import { BookListsController } from "./api/book-lists.controller.js";
import { BookLoanBatchController } from "./api/book-loan-batch.controller.js";
import { BookLoanController } from "./api/book-loan.controller.js";
import { BookOwnershipController } from "./api/book-ownership.controller.js";
import { BookReadingController } from "./api/book-reading.controller.js";
import { BookStoreLinkController } from "./api/book-store-link.controller.js";
import { BooksController } from "./api/books.controller.js";
import { BulkBooksController } from "./api/bulk-books.controller.js";
import { ListDetailsController } from "./api/list-details.controller.js";
import { ListMembershipController } from "./api/list-membership.controller.js";
import { BookAccessService } from "./application/book-access.service.js";
import { BookCoverCleanup } from "./application/book-cover-cleanup.js";
import { BookDeliveryService } from "./application/book-delivery.service.js";
import { BookFacetsService } from "./application/book-facets.service.js";
import { BookLibraryReadService } from "./application/book-library-read.service.js";
import { BookLifecycleService } from "./application/book-lifecycle.service.js";
import { BookListsService } from "./application/book-lists.service.js";
import { BookLoanBatchService } from "./application/book-loan-batch.service.js";
import { BookLoanService } from "./application/book-loan.service.js";
import { BookOwnershipService } from "./application/book-ownership.service.js";
import { BookPurgeProcessor } from "./application/book-purge.processor.js";
import { BookPurgeReconciler } from "./application/book-purge.reconciler.js";
import { BookPurgeScheduler } from "./application/book-purge.scheduler.js";
import { BookReadingService } from "./application/book-reading.service.js";
import { BookRelationsResolver } from "./application/book-relations-resolver.js";
import { BookStoreLinkService } from "./application/book-store-link.service.js";
import { BookViewAssembler } from "./application/book-view-assembler.js";
import { BooksService } from "./application/books.service.js";
import { BulkBooksService } from "./application/bulk-books.service.js";
import { DedicationsService } from "./application/dedications.service.js";
import { ListDetailsService } from "./application/list-details.service.js";
import { ListFacetsService } from "./application/list-facets.service.js";
import { ListMembershipService } from "./application/list-membership.service.js";
import { ListOverviewService } from "./application/list-overview.service.js";
import { ReadingHistoryCorrectionService } from "./application/reading-history-correction.service.js";
import { ReadingHistoryProvenanceService } from "./application/reading-history-provenance.service.js";
import { ReadingLifecycleCoordinator } from "./application/reading-lifecycle.coordinator.js";
import { WishlistService } from "./application/wishlist.service.js";
import { BOOK_PURGE_QUEUE_NAME } from "./domain/book-purge.js";
import { BookFacetsRepository } from "./infrastructure/book-facets.repository.js";
import { BookLibraryReadRepository } from "./infrastructure/book-library-read.repository.js";
import { BookListsRepository } from "./infrastructure/book-lists.repository.js";
import { BookStoreLinkRepository } from "./infrastructure/book-store-link.repository.js";
import { BooksRepository } from "./infrastructure/books.repository.js";
import { BulkBooksRepository } from "./infrastructure/bulk-books.repository.js";
import { ListBooksRepository } from "./infrastructure/list-books.repository.js";
import { ListFacetsRepository } from "./infrastructure/list-facets.repository.js";
import { ListMembershipRepository } from "./infrastructure/list-membership.repository.js";
import { ListOverviewRepository } from "./infrastructure/list-overview.repository.js";
import { ReadingCycleRepository } from "./infrastructure/reading-cycle.repository.js";
import { ReadingHistoryStateRepository } from "./infrastructure/reading-history-state.repository.js";

@Module({
  controllers: [
    BooksController,
    BookReadingController,
    BookOwnershipController,
    BookLoanBatchController,
    BookLoanController,
    BookDeliveryController,
    BookStoreLinkController,
    BulkBooksController,
    ListDetailsController,
    ListMembershipController,
    BookListsController,
  ],
  exports: [
    BookAccessService,
    BookReadingService,
    BookViewAssembler,
    ReadingHistoryProvenanceService,
  ],
  imports: [
    AuthModule,
    AuthorsModule,
    ProfileModule,
    PublishersModule,
    TagsModule,
    SeriesModule,
    ListsModule,
    forwardRef(() => LoansModule),
    GenresModule,
    MediaModule,
    DeliveryModule,
    ReadingGoalsModule,
    BullModule.registerQueue({ name: BOOK_PURGE_QUEUE_NAME }),
  ],
  providers: [
    BooksService,
    BookAccessService,
    BookLibraryReadService,
    BookLifecycleService,
    BookPurgeScheduler,
    BookPurgeProcessor,
    BookPurgeReconciler,
    BookRelationsResolver,
    BookViewAssembler,
    BookCoverCleanup,
    BookReadingService,
    ReadingLifecycleCoordinator,
    ReadingHistoryProvenanceService,
    ReadingHistoryCorrectionService,
    ReadingCycleRepository,
    ReadingHistoryStateRepository,
    BookOwnershipService,
    BookLoanBatchService,
    BookLoanService,
    BookDeliveryService,
    BookStoreLinkService,
    WishlistService,
    DedicationsService,
    BookLibraryReadRepository,
    BooksRepository,
    BookStoreLinkRepository,
    BulkBooksService,
    BulkBooksRepository,
    ListDetailsService,
    ListBooksRepository,
    ListFacetsService,
    ListFacetsRepository,
    BookFacetsService,
    BookFacetsRepository,
    ListOverviewService,
    ListOverviewRepository,
    ListMembershipService,
    ListMembershipRepository,
    BookListsService,
    BookListsRepository,
  ],
})
export class BooksModule {}
