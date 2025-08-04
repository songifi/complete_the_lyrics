import { Injectable } from '@nestjs/common';
import { S3Service } from './s3.service';
import { EvidenceValidator } from '../validators/evidence.validator';

@Injectable()
export class EvidenceService {
  constructor(private readonly s3Service: S3Service) {}

  async uploadEvidence(file: Express.Multer.File): Promise<string> {
    if (!EvidenceValidator.isValid(file)) {
      throw new Error('Invalid evidence file');
    }
    const url = await this.s3Service.uploadEvidence(file.buffer, file.originalname, file.mimetype);
    return url;
  }
}
