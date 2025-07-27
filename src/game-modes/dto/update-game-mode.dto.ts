import { PartialType } from "@nestjs/mapped-types"
import { CreateGameModeDto } from "./create-game-mode.dto"

export class UpdateGameModeDto extends PartialType(CreateGameModeDto) {}
