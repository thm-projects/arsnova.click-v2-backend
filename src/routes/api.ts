import { Request, Response, Router } from 'express';
import * as fileType from 'file-type';
import * as fs from 'fs';
import * as path from 'path';
import { settings, staticStatistics } from '../statistics';

declare global {
  interface IUploadRequest extends Request {
    busboy: any;
  }

  interface I18nResponse extends Response {
    __mf: any;
  }
}

export class ApiRouter {
  get router(): Router {
    return this._router;
  }

  private readonly _router: Router;

  /**
   * Initialize the ApiRouter
   */
  constructor() {
    this._router = Router();
    this.init();
  }

  public getAll(req: Request, res: Response): void {
    res.send({
      serverConfig: settings.public,
    });
  }

  public randomFile(dir: string): string {
    const items = fs.readdirSync(dir);
    return items[Math.floor(Math.random() * items.length)];
  }

  public getFileByName(req: Request, res: Response): void {
    const pathToFiles: string = path.join(staticStatistics.pathToAssets, `${req.params.directory}`, `${req.params.subdirectory}`);
    let file = '';

    if (req.params.fileName.indexOf('Random') > -1) {
      file = this.randomFile(pathToFiles);

    } else {
      if (!fs.existsSync(path.join(`${pathToFiles}`, `${req.params.fileName}`))) {
        res.status(404);
        res.end();
        return;
      }

      file = req.params.fileName;
    }

    res.send(fs.readFileSync(path.join(`${pathToFiles}`, file)));
  }

  public getThemeImageFileByName(req: Request, res: Response): void {
    const pathToFiles = path.join(staticStatistics.pathToAssets, 'images', 'theme', `${req.params.themeName}`, `${req.params.fileName}`);
    if (fs.existsSync(pathToFiles)) {
      fs.readFile(pathToFiles, (err, data: Buffer) => {
        res.contentType(fileType(data).mime);
        res.end(data);
      });
    } else {
      res.status(404);
      res.end('File not found');
    }
  }

  /**
   * Take each handler, and attach to one of the Express.Router's
   * endpoints.
   */
  private init(): void {
    this._router.get('/', this.getAll);
    this._router.get('/files/images/theme/:themeName/:fileName', this.getThemeImageFileByName.bind(this));
    this._router.get('/files/:directory/:subdirectory/:fileName', this.getFileByName.bind(this));
  }

}

// Create the ApiRouter, and export its configured Express.Router
const apiRoutes = new ApiRouter();
const apiRouter = apiRoutes.router;
export { apiRouter };

