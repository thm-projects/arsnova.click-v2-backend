import * as Converter from 'api-spec-converter';
import { Request, Response } from 'express';
import fileType from 'file-type';
import * as fs from 'fs';
import { OpenAPIObject } from 'openapi3-ts';
import * as path from 'path';
import { Get, getMetadataArgsStorage, JsonController, NotFoundError, Param, Res } from 'routing-controllers';
import { OpenAPI, routingControllersToSpec } from 'routing-controllers-openapi';
import { routingControllerOptions } from '../../App';
import { settings, staticStatistics } from '../../statistics';
import { AbstractRouter } from './AbstractRouter';

declare global {
  interface IUploadRequest extends Request {
    busboy: any;
  }

  interface ICustomI18nResponse extends Response {
    __mf: any;
  }
}

@JsonController('/api/v1')
export class ApiRouter extends AbstractRouter {
  private static homedir = path.join(require('os').homedir(), '.arsnova-click-v2');
  private static _specFile = path.join(ApiRouter.homedir, 'spec.json');

  private openAPISpec(): OpenAPIObject {
    const storage = getMetadataArgsStorage();
    return routingControllersToSpec(storage, routingControllerOptions, {
      info: {
        title: staticStatistics.appName,
        version: staticStatistics.appVersion,
      },
    });
  }

  private regenerateSpecFile(): void {
    const spec = this.openAPISpec();
    if (!fs.existsSync(ApiRouter.homedir)) {
      fs.mkdirSync(ApiRouter.homedir, { recursive: true });
    }
    fs.writeFileSync(ApiRouter._specFile, JSON.stringify(spec));
  }

  @Get('/') //
  @OpenAPI({
    description: 'Returns the current server settings',
  })
  private getAll(): object {
    return {
      serverConfig: settings.public,
    };
  }

  @Get('/api-docs.json') //
  @OpenAPI({
    summary: 'Swagger v2 Spec',
    description: 'Generates the Swagger Spec from the OpenAPI Spec',
  })
  private async swaggerSpec(): Promise<void> {
    if (fs.existsSync(ApiRouter._specFile)) {
      const statsOfSpec = fs.statSync(ApiRouter._specFile);
      const statsOfIndex = fs.statSync(path.join(__dirname, '..', '..', 'main.js'));
      if (!statsOfSpec || statsOfSpec.birthtime.getTime() < statsOfIndex.birthtime.getTime()) {
        this.regenerateSpecFile();
      }
    } else {
      this.regenerateSpecFile();
    }
    return new Promise<void>((resolve, reject) => {
      Converter.convert({
        from: 'openapi_3',
        to: 'swagger_2',
        source: ApiRouter._specFile,
      })
      .catch(reason => reject(reason))
      .then(converted => {
        if (!converted) {
          return;
        }

        resolve(converted.spec);
      });
    });
  }

  @Get('/files/:directory/:subdirectory/:fileName') //
  @OpenAPI({
    summary: 'Transfers assets like sound files for the quizzes',
  })
  private getFileByName(
    @Param('directory') directory: string, //
    @Param('subdirectory') subdirectory: string, //
    @Param('fileName') fileName: string,
  ): object {

    const pathToFiles: string = path.join(staticStatistics.pathToAssets, `${directory}`, `${subdirectory}`);
    let file = '';

    if (fileName.toLowerCase().includes('random')) {
      file = this.randomFile(pathToFiles);

    } else {
      if (!fs.existsSync(path.join(`${pathToFiles}`, `${fileName}`))) {
        throw new NotFoundError();
      }

      file = fileName;
    }

    return fs.readFileSync(path.join(`${pathToFiles}`, file));
  }

  @Get('/files/images/theme/:themeName/:fileName') //
  @OpenAPI({
    deprecated: true,
  })
  private getThemeImageFileByName(
    @Param('themeName') themeName: string, //
    @Param('fileName') fileName: string, //
    @Res() res: Response,
  ): object {

    const pathToFiles = path.join(staticStatistics.pathToAssets, 'images', 'theme', `${themeName}`, `${fileName}`);
    if (fs.existsSync(pathToFiles)) {
      const data: Buffer = fs.readFileSync(pathToFiles);
      res.contentType(fileType(data).mime);
      return data;
    } else {
      throw new NotFoundError('File not found');
    }
  }

  private randomFile(dir: string): string {
    const items = fs.readdirSync(dir);
    return items[Math.floor(Math.random() * items.length)];
  }
}
