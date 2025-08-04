export class AuditLogger {
  static log(action: string, details: any) {
    // In production, log to file/db
    console.log(`[AUDIT] ${action}:`, details);
  }
}
