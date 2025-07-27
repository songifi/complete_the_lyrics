import { PartialType, OmitType } from "@nestjs/mapped-types"
import { CreateGuildDto } from "./create-guild.dto"

export class UpdateGuildDto extends PartialType(OmitType(CreateGuildDto, ["name"] as const)) {}
