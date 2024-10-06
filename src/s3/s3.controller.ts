// src/s3/s3.controller.ts

import { Controller, Get, Query, Param, Res, HttpStatus } from '@nestjs/common';
import { S3Service } from './s3.service.js';
import { Response } from 'express';

@Controller('s3')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Get('verify')
  async verifyAWS() {
    const isAuthenticated = await this.s3Service.verifyAWSAuthentication();
    return { authenticated: isAuthenticated };
  }

  /**
   * List objects in the Landsat bucket with optional prefix and pagination
   * Example: GET /s3/list?prefix=LC08/01/012/034/
   */
  @Get('list')
  async listObjects(
    @Query('prefix') prefix: string = 'collection02/',
    @Query('continuationToken') continuationToken?: string,
  ) {
    const response = await this.s3Service.listObjects(
      prefix,
      continuationToken,
    );
    return {
      contents: response.Contents,
      isTruncated: response.IsTruncated,
      nextContinuationToken: response.NextContinuationToken,
    };
  }

  //   /**
  //    * Get a specific object from the Landsat bucket
  //    * Example: GET /s3/object/LC08/01/012/034/LC08_L1TP_012034_20210430_20210507_01_T1.tar.gz
  //    */
  //   @Get('object/*')
  //   async getObject(@Param() params, @Res() res: Response) {
  //     // Extract the object key from the URL
  //     const key = Object.values(params).join('/');

  //     try {
  //       const data = await this.s3Service.getObject(key);
  //       // Set appropriate headers based on your use case
  //       res.set({
  //         'Content-Type': 'application/octet-stream',
  //         'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`,
  //       });
  //       res.status(HttpStatus.OK).send(data);
  //     } catch (error) {
  //       res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
  //         message: 'Error retrieving the object',
  //         error: error.message,
  //       });
  //     }
  //   }

  @Get('object/*')
  async getObject(@Param('0') key: string, @Res() res: Response) {
    // '0' captures the wildcard segment
    // Replace backslashes with forward slashes if necessary
    const sanitizedKey = key.replace(/\\/g, '/');

    try {
      const data = await this.s3Service.getObject(sanitizedKey);
      res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${sanitizedKey.split('/').pop()}"`,
      });
      res.status(HttpStatus.OK).send(data);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Error retrieving the object',
        error: error.message,
      });
    }
  }

  @Get('get-geotiff-stream/*')
  async getGeoTIFFStream(@Param('0') key: string, @Res() res: Response) {
    try {
      const sanitizedKey = key.replace(/\\/g, '/');

      // Get the GeoTIFF stream
      const stream = await this.s3Service.getGeoTIFFStream(sanitizedKey);

      // Set response headers
      res.set({
        'Content-Type': 'image/tiff', // Set to the correct MIME type
        'Content-Disposition': `inline; filename="${sanitizedKey.split('/').pop()}"`, // Optional: filename in the response
      });

      // Pipe the stream directly to the response
      stream.pipe(res);
    } catch (error) {
      console.error(`Error fetching GeoTIFF for key: ${key}`, error);
      return res.status(HttpStatus.NOT_FOUND).json({
        message: `Cannot GET /s3/get-geotiff/${key}`,
        error: 'Not Found',
        statusCode: HttpStatus.NOT_FOUND,
      });
    }
  }

  @Get('get-geotiff/*')
  async getGeoTIFF(@Param('0') key: string, @Res() res: Response) {
    try {
      // Sanitize the key to replace backslashes with forward slashes
      const sanitizedKey = key.replace(/\\/g, '/');

      const data = await this.s3Service.getGeoTIFF(sanitizedKey);

      // Log the retrieved data
      console.log('GeoTIFF Data:', data);

      // Send the response with the data
      return res.status(HttpStatus.OK).json({
        rasterData: data.rasterData,
        width: data.width,
        height: data.height,
      });
    } catch (error) {
      // Log the error for debugging
      console.error(`Error fetching GeoTIFF for key: ${key}`, error);

      // Send an error response
      return res.status(HttpStatus.NOT_FOUND).json({
        message: `Cannot GET /s3/get-geotiff/${key}`,
        error: 'Not Found',
        statusCode: HttpStatus.NOT_FOUND,
      });
    }
  }
}
