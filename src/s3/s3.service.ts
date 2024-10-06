import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { ConfigService } from '@nestjs/config';
import * as GeoTIFF from 'geotiff';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName = 'usgs-landsat';

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  /**
   * Verify AWS authentication by listing buckets
   */
  async verifyAWSAuthentication(): Promise<boolean> {
    try {
      const command = new ListBucketsCommand({});
      await this.s3Client.send(command);
      this.logger.log('Successfully authenticated with AWS.');
      return true; // Authentication successful
    } catch (error) {
      this.logger.error('Failed to authenticate with AWS:', error);
      return false; // Authentication failed
    }
  }

  /**
   * List objects in the bucket with an optional prefix
   * @param prefix S3 prefix to filter objects
   * @param continuationToken Token for pagination
   */
  async listObjects(
    prefix: string = 'collection02/',
    continuationToken?: string,
  ) {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        RequestPayer: 'requester', // This enables requester-pays
      });

      const response = await this.s3Client.send(command);
      return response;
    } catch (error) {
      this.logger.error('Error listing objects from S3', error);
      throw error;
    }
  }

  /**
   * Get an object from the bucket
   * @param key S3 object key
   */
  async getObject(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        RequestPayer: 'requester', // This enables requester-pays
      });

      const response = await this.s3Client.send(command);
      const stream = response.Body as Readable;

      return await this.streamToBuffer(stream);
    } catch (error) {
      this.logger.error(`Error getting object ${key} from S3`, error);
      throw error;
    }
  }

  /**
   * Convert a Readable stream to a Buffer
   * @param stream Readable stream
   */
  private streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /**
   * Get GeoTIFF data from S3
   * @param key S3 object key for the GeoTIFF file
   */
  async getGeoTIFF(key: string): Promise<{
    rasterData: GeoTIFF.ReadRasterResult;
    width: number;
    height: number;
  }> {
    try {
      console.log(`Fetching GeoTIFF from S3 with key: ${key}`);
      const buffer: Buffer = await this.getObject(key);

      // Log the buffer to check its contents
      console.log('Retrieved Buffer:', buffer);

      // Convert Buffer to ArrayBuffer
      const arrayBuffer: ArrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      );

      // Use geotiff.js to read the GeoTIFF
      const geoTiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
      const image = await geoTiff.getImage();
      const rasterData = await image.readRasters();
      const width = image.getWidth();
      const height = image.getHeight();

      console.log('Raster data:', rasterData);

      return {
        rasterData, // This will be a Uint8Array or similar
        width,
        height,
      };
    } catch (error) {
      console.error('Error in getGeoTIFF:', error);
      throw new Error('Could not retrieve GeoTIFF data');
    }
  }

  /**
   * Get a stream of the GeoTIFF data from S3
   * @param key S3 object key for the GeoTIFF file
   */
  async getGeoTIFFStream(key: string): Promise<Readable> {
    try {
      this.logger.log(`Fetching GeoTIFF stream from S3 with key: ${key}`);
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        RequestPayer: 'requester', // This enables requester-pays
      });

      const response = await this.s3Client.send(command);
      const stream = response.Body as Readable;

      return stream; // Return the stream directly
    } catch (error) {
      this.logger.error(`Error getting GeoTIFF stream for key: ${key}`, error);
      throw new Error('Could not retrieve GeoTIFF stream');
    }
  }
}
