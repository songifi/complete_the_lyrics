import { type PipeTransform, Injectable, BadRequestException } from "@nestjs/common"
import * as Filter from "bad-words"

@Injectable()
export class ProfanityFilterPipe implements PipeTransform {
  private filter = new Filter()

  transform(value: any) {
    if (typeof value === "object" && value.content) {
      if (this.filter.isProfane(value.content)) {
        throw new BadRequestException("Message contains inappropriate content")
      }
      // Clean the content
      value.content = this.filter.clean(value.content)
    }
    return value
  }
}
