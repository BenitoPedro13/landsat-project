import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { S3Service } from './s3/s3.service.js';
import { S3Controller } from './s3/s3.controller.js';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes the configuration global
    }),
  ],
  controllers: [AppController, S3Controller],
  providers: [AppService, S3Service, ConfigService],
})
export class AppModule {}
