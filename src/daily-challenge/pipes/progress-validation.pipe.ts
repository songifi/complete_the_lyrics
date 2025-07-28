import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ProgressValidationPipe implements PipeTransform {
  transform(value: any) {
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Progress must be an object');
    }
    for (const key in value) {
      if (typeof value[key] !== 'number' || value[key] < 0) {
        throw new BadRequestException(`Invalid progress value for ${key}`);
      }
    }
    return value;
  }
} 