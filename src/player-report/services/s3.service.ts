import AWS from 'aws-sdk';

export class S3Service {
  private s3: AWS.S3;
  private bucket: string;

  constructor(bucket: string) {
    this.s3 = new AWS.S3();
    this.bucket = bucket;
  }

  async uploadEvidence(file: Buffer, filename: string, mimetype: string): Promise<string> {
    const params = {
      Bucket: this.bucket,
      Key: filename,
      Body: file,
      ContentType: mimetype,
      ACL: 'private',
    };
    const result = await this.s3.upload(params).promise();
    return result.Location;
  }
}
