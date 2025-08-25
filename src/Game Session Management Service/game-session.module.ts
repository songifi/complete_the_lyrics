import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { GameSessionService } from "./game-session.service";
import { GameSessionController } from "./game-session.controller";

@Module({
  imports: [ScheduleModule.forRoot(), EventEmitterModule.forRoot()],
  providers: [GameSessionService],
  controllers: [GameSessionController],
  exports: [GameSessionService],
})
export class GameSessionModule {}
