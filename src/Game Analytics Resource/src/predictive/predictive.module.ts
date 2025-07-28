import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { MLModelsService } from "./services/ml-models.service"
import { PlayerBehavior } from "../player/entities/player-behavior.entity"

@Module({
  imports: [TypeOrmModule.forFeature([PlayerBehavior])],
  providers: [MLModelsService],
  exports: [MLModelsService],
})
export class PredictiveModule {}
