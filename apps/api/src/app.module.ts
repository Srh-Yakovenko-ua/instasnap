import type { MiddlewareConsumer, NestModule } from "@nestjs/common";

import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { DatabaseModule } from "./core/database/database.module.js";
import { RequestIdMiddleware } from "./core/middleware/request-id.middleware.js";
import { RequestLoggerMiddleware } from "./core/middleware/request-logger.middleware.js";
import { QueueModule } from "./core/queue/queue.module.js";
import { GLOBAL_THROTTLE } from "./core/throttle.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { AuthorsModule } from "./modules/authors/authors.module.js";
import { BooksModule } from "./modules/books/books.module.js";
import { ChangelogModule } from "./modules/changelog/changelog.module.js";
import { CharactersModule } from "./modules/characters/characters.module.js";
import { DeliveryServicesModule } from "./modules/delivery-services/index.js";
import { DeliveryModule } from "./modules/delivery/index.js";
import { GenresModule } from "./modules/genres/genres.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { ListsModule } from "./modules/lists/lists.module.js";
import { LoansModule } from "./modules/loans/loans.module.js";
import { MediaModule } from "./modules/media/media.module.js";
import { NotesModule } from "./modules/notes/notes.module.js";
import { NotificationsModule } from "./modules/notifications/notifications.module.js";
import { MetricsMiddleware } from "./modules/observability/metrics.middleware.js";
import { MetricsModule } from "./modules/observability/metrics.module.js";
import { ProfileModule } from "./modules/profile/profile.module.js";
import { PublishersModule } from "./modules/publishers/publishers.module.js";
import { QuotesModule } from "./modules/quotes/index.js";
import { ReadingGoalsModule } from "./modules/reading-goals/index.js";
import { ReadingQueueModule } from "./modules/reading-queue/index.js";
import { RealtimeModule } from "./modules/realtime/index.js";
import { SeriesOrderCheckModule } from "./modules/series-order-check/index.js";
import { SeriesModule } from "./modules/series/series.module.js";
import { StatisticsModule } from "./modules/statistics/index.js";
import { TagsModule } from "./modules/tags/tags.module.js";
import { TimelineModule } from "./modules/timeline/timeline.module.js";
import { TrashModule } from "./modules/trash/trash.module.js";

@Module({
  imports: [
    ThrottlerModule.forRoot([GLOBAL_THROTTLE]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    QueueModule,
    HealthModule,
    MetricsModule,
    AuthModule,
    ProfileModule,
    AuthorsModule,
    PublishersModule,
    TagsModule,
    SeriesModule,
    ListsModule,
    BooksModule,
    GenresModule,
    RealtimeModule,
    MediaModule,
    DeliveryServicesModule,
    ReadingQueueModule,
    SeriesOrderCheckModule,
    LoansModule,
    DeliveryModule,
    ChangelogModule,
    QuotesModule,
    ReadingGoalsModule,
    StatisticsModule,
    NotesModule,
    TimelineModule,
    TrashModule,
    CharactersModule,
    NotificationsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware, MetricsMiddleware, RequestLoggerMiddleware)
      .forRoutes("*splat");
  }
}
