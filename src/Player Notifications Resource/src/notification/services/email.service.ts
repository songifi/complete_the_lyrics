import { Injectable, Logger } from "@nestjs/common"
import type { ConfigService } from "@nestjs/config"
import * as nodemailer from "nodemailer"
import * as handlebars from "handlebars"
import * as fs from "fs"
import * as path from "path"
import type { Notification } from "../entities/notification.entity"

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private transporter: nodemailer.Transporter
  private templates: Map<string, handlebars.TemplateDelegate> = new Map()

  constructor(private configService: ConfigService) {
    this.initializeTransporter()
    this.loadTemplates()
  }

  private initializeTransporter(): void {
    this.transporter = nodemailer.createTransporter({
      host: this.configService.get("SMTP_HOST"),
      port: this.configService.get("SMTP_PORT"),
      secure: this.configService.get("SMTP_SECURE") === "true",
      auth: {
        user: this.configService.get("SMTP_USER"),
        pass: this.configService.get("SMTP_PASS"),
      },
    })
  }

  private loadTemplates(): void {
    const templatesDir = path.join(__dirname, "../templates")

    if (!fs.existsSync(templatesDir)) {
      this.logger.warn("Templates directory not found")
      return
    }

    const templateFiles = fs.readdirSync(templatesDir).filter((file) => file.endsWith(".hbs"))

    for (const file of templateFiles) {
      const templateName = path.basename(file, ".hbs")
      const templatePath = path.join(templatesDir, file)
      const templateContent = fs.readFileSync(templatePath, "utf8")

      this.templates.set(templateName, handlebars.compile(templateContent))
      this.logger.log(`Loaded email template: ${templateName}`)
    }
  }

  async sendNotification(notification: Notification): Promise<void> {
    try {
      let htmlContent = notification.content

      // Use template if specified
      if (notification.templateId && this.templates.has(notification.templateId)) {
        const template = this.templates.get(notification.templateId)
        htmlContent = template(notification.templateData || {})
      }

      const mailOptions = {
        from: this.configService.get("SMTP_FROM"),
        to: await this.getUserEmail(notification.userId),
        subject: notification.title,
        html: htmlContent,
        text: this.stripHtml(htmlContent),
      }

      await this.transporter.sendMail(mailOptions)
      this.logger.log(`Email sent successfully for notification ${notification.id}`)
    } catch (error) {
      this.logger.error(`Failed to send email for notification ${notification.id}: ${error.message}`)
      throw error
    }
  }

  private async getUserEmail(userId: string): Promise<string> {
    // This should be implemented based on your user service
    // For now, returning a placeholder
    return `user-${userId}@example.com`
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "")
  }
}
