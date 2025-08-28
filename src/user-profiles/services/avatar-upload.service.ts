import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { UploadAvatarDto } from '../dto/upload-avatar.dto';
import { IAvatarUploadResult } from '../interfaces/user-profile.interface';

@Injectable()
export class AvatarUploadService {
  private s3: AWS.S3;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.s3 = new AWS.S3({
      accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      region: this.configService.get('AWS_REGION'),
    });
    this.bucketName = this.configService.get('AWS_S3_BUCKET_NAME');
  }

  async uploadAvatar(file: Express.Multer.File, uploadAvatarDto: UploadAvatarDto): Promise<IAvatarUploadResult> {
    // Validate file
    this.validateFile(file);

    // Process image
    const processedImage = await this.processImage(file, uploadAvatarDto);

    // Generate unique key
    const key = `avatars/${uuidv4()}-${Date.now()}.webp`;

    // Upload to S3
    const uploadParams = {
      Bucket: this.bucketName,
      Key: key,
      Body: processedImage,
      ContentType: 'image/webp',
      ACL: 'public-read',
      Metadata: {
        originalName: file.originalname,
        originalSize: file.size.toString(),
        processedSize: processedImage.length.toString(),
        width: uploadAvatarDto.maxWidth.toString(),
        height: uploadAvatarDto.maxHeight.toString(),
        quality: uploadAvatarDto.quality.toString(),
      },
    };

    try {
      const result = await this.s3.upload(uploadParams).promise();

      return {
        url: result.Location,
        key: key,
        size: processedImage.length,
        width: uploadAvatarDto.maxWidth,
        height: uploadAvatarDto.maxHeight,
        format: 'webp',
      };
    } catch (error) {
      throw new BadRequestException('Failed to upload avatar');
    }
  }

  async deleteAvatar(key: string): Promise<void> {
    try {
      await this.s3.deleteObject({
        Bucket: this.bucketName,
        Key: key,
      }).promise();
    } catch (error) {
      // Log error but don't throw - avatar might already be deleted
      console.error('Failed to delete avatar:', error);
    }
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size too large. Maximum size is 5MB');
    }

    // Check file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed');
    }
  }

  private async processImage(file: Express.Multer.File, uploadAvatarDto: UploadAvatarDto): Promise<Buffer> {
    try {
      let image = sharp(file.buffer);

      // Get image metadata
      const metadata = await image.metadata();

      // Resize image while maintaining aspect ratio
      image = image.resize({
        width: uploadAvatarDto.maxWidth,
        height: uploadAvatarDto.maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      });

      // Convert to WebP format with specified quality
      const processedImage = await image
        .webp({ quality: uploadAvatarDto.quality })
        .toBuffer();

      return processedImage;
    } catch (error) {
      throw new BadRequestException('Failed to process image');
    }
  }

  async generateAvatarUrl(key: string): Promise<string> {
    try {
      const url = await this.s3.getSignedUrlPromise('getObject', {
        Bucket: this.bucketName,
        Key: key,
        Expires: 3600, // 1 hour
      });
      return url;
    } catch (error) {
      throw new BadRequestException('Failed to generate avatar URL');
    }
  }

  async getAvatarInfo(key: string): Promise<any> {
    try {
      const result = await this.s3.headObject({
        Bucket: this.bucketName,
        Key: key,
      }).promise();

      return {
        size: result.ContentLength,
        contentType: result.ContentType,
        lastModified: result.LastModified,
        metadata: result.Metadata,
      };
    } catch (error) {
      throw new BadRequestException('Avatar not found');
    }
  }
}
