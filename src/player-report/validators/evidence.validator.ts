export class EvidenceValidator {
  static isValid(file: any): boolean {
    // Only allow images and videos, max 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'video/mp4'];
    const maxSize = 10 * 1024 * 1024;
    return allowedTypes.includes(file.mimetype) && file.size <= maxSize;
  }
}
