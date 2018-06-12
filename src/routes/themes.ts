import { Request, Response, Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { staticStatistics } from '../statistics';
import { themes } from '../themes/availableThemes';

export class ThemesRouter {
  private _router: Router;

  get router(): Router {
    return this._router;
  }

  /**
   * Initialize the ThemesRouter
   */
  constructor() {
    this._router = Router();
    this.init();
  }

  public getThemes(req: Request, res: Response): void {
    res.send({
      status: 'STATUS:SUCCESSFUL', step: 'GET_THEMES', payload: themes,
    });
  }

  public getTheme(req: Request, res: Response): void {
    const filePath = path.join(staticStatistics.pathToAssets, 'images', 'theme', req.params.themeId,
      `preview_${req.params.languageId}.png`);
    const exists = fs.existsSync(filePath);

    if (exists) {
      fs.readFile(filePath, (err, data: Buffer) => {
        res.setHeader('Content-Type', 'image/png');
        res.end(data);
      });
    }
  }

  public init(): void {
    this._router.get('/', this.getThemes);
    this._router.get('/:themeId/:languageId', this.getTheme);
  }
}

// Create the ApiRouter, and export its configured Express.Router
const themesRoutes = new ThemesRouter();
const themesRouter = themesRoutes.router;
export { themesRouter };
