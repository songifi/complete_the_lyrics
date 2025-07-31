import { type PipeTransform, Injectable } from "@nestjs/common"

@Injectable()
export class MessageFormattingPipe implements PipeTransform {
  transform(value: any) {
    if (typeof value === "object" && value.content) {
      // Format rich text, convert markdown-like syntax
      value.content = this.formatRichText(value.content)
    }
    return value
  }

  private formatRichText(content: string): string {
    // Convert basic markdown to HTML-like format
    content = content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    content = content.replace(/\*(.*?)\*/g, "<em>$1</em>")
    content = content.replace(/`(.*?)`/g, "<code>$1</code>")

    // Convert emoji shortcodes
    content = content.replace(/:smile:/g, "😊")
    content = content.replace(/:heart:/g, "❤️")
    content = content.replace(/:thumbsup:/g, "👍")

    return content
  }
}
