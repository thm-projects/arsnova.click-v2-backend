import { NextFunction, Request, Response, Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { I18nDAO } from '../db/I18nDAO';
import { availableLangs, i18nFileBaseLocation, projectAppLocation, projectBaseLocation, projectGitLocation } from '../statistics';

export class I18nApiRouter {
  private _router: Router;

  get router(): Router {
    return this._router;
  }

  /**
   * Initialize the I18nApiRouter
   */
  constructor() {
    this._router = Router();
    this.init();
  }

  public init(): void {
    this._router.param('project', (req: any, res, next, project) => {
      if (!project || !i18nFileBaseLocation[project]) {
        res.status(500).send({ status: 'STATUS:FAILED', data: 'Invalid Project specified', payload: { project } });
      } else {
        req.i18nFileBaseLocation = i18nFileBaseLocation[project];
        req.projectBaseLocation = projectBaseLocation[project];
        req.projectAppLocation = projectAppLocation[project];
        req.projectGitLocation = projectGitLocation[project];
        req.projectCache = project;
        next();
      }
    });
    this._router.get('/', this.getAll);
    this._router.get('/:project/langFile', this.getLangFile);
    this._router.post('/:project/updateLang', this.updateLang);
  }

  private getAll(req: Request, res: Response, next: NextFunction): void {
    res.json({});
  }

  private getLangFile(req: any, res: Response, next: NextFunction): void {
    const payload = { langData: {}, unused: {}, branch: {} };

    if (!I18nDAO.cache[req.projectCache].langData) {
      const langData = [];
      availableLangs.forEach((langRef, index) => {
        I18nDAO.buildKeys({
          root: '',
          dataNode: JSON.parse(fs.readFileSync(path.join(req.i18nFileBaseLocation, `${langRef}.json`)).toString('UTF-8')),
          langRef,
          langData,
        });
      });
      I18nDAO.cache[req.projectCache].langData = langData;
    }
    payload.langData = I18nDAO.cache[req.projectCache].langData;

    if (!I18nDAO.cache[req.projectCache].unused) {
      I18nDAO.cache[req.projectCache].unused = I18nDAO.getUnusedKeys(req);
    }
    payload.unused = I18nDAO.cache[req.projectCache].unused;

    if (!I18nDAO.cache[req.projectCache].branch) {
      I18nDAO.cache[req.projectCache].branch = I18nDAO.getBranch(req);
    }
    payload.branch = I18nDAO.cache[req.projectCache].branch;

    res.send({ status: 'STATUS:SUCCESSFUL', payload });
  }

  private updateLang(req: any, res: Response, next: NextFunction): void {
    if (!req.body.data) {
      res.status(500).send({ status: 'STATUS:FAILED', data: 'Invalid Data', payload: { body: req.body } });
      return;
    }

    const result = { en: {}, de: {}, es: {}, fr: {}, it: {} };
    const langKeys = Object.keys(result);
    I18nDAO.createObjectFromKeys({ data: req.body.data, result });

    I18nDAO.cache[req.projectCache].langData = req.body.data;

    langKeys.forEach((langRef, index) => {
      const fileContent = result[langRef];
      const fileLocation = path.join(req.i18nFileBaseLocation, `${langRef}.json`);
      const exists = fs.existsSync(fileLocation);
      if (!exists) {
        res.status(404).send({ status: 'STATUS:FAILED', data: 'File not found', payload: { fileLocation } });
        return;
      }
      fs.writeFileSync(fileLocation, JSON.stringify(fileContent));
      if (index === langKeys.length - 1) {
        res.send({ status: 'STATUS:SUCCESSFUL' });
      }
    });
  }
}

// Create the I18nApiRouter, and export its configured Express.Router
const i18nApiRoutes = new I18nApiRouter();
const i18nApiRouter = i18nApiRoutes.router;
export { i18nApiRouter };
