import { ICommitAction, IGitlabCommitAction } from 'arsnova-click-v2-types/src/gitlab/apiv4';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import Gitlab from 'gitlab';
import * as path from 'path';
import { COMMIT_ACTION, GITLAB, LANGUAGES } from '../Enums';
import { availableLangs, i18nFileBaseLocation, projectAppLocation, projectGitLocation, staticStatistics } from '../statistics';
import { AbstractDAO } from './AbstractDAO';
import LoginDAO from './LoginDAO';

class I18nDAO extends AbstractDAO<object> {

  private readonly mergeRequestTitle = 'WIP: Update i18n keys';
  private readonly commitMessage = 'Updates i18n keys';

  constructor(storage: object) {
    super(storage);
  }

  public static getInstance(): I18nDAO {
    if (!this.instance) {
      this.instance = new I18nDAO({ 'arsnova-click-v2-backend': {} });
    }
    return this.instance;
  }

  public reloadCache(): void {
    Object.keys(this.storage).forEach(projectName => {
      console.log(``);
      console.log(`------- Building cache for '${projectName}' -------`);

      console.log(`* Fetching language data`);
      const langDataStart = new Date().getTime();
      const langData = [];
      availableLangs.forEach(langRef => {
        this.buildKeys({
          root: '',
          dataNode: JSON.parse(fs.readFileSync(path.join(i18nFileBaseLocation[projectName], `${langRef}.json`)).toString('UTF-8')),
          langRef,
          langData,
        });
      });
      this.storage[projectName].langData = langData;
      const langDataEnd = new Date().getTime();
      console.log(`-- Done. Took ${langDataEnd - langDataStart}ms`);

      console.log(`* Fetching unused keys`);
      const unusedKeysStart = new Date().getTime();
      this.storage[projectName].unused = this.getUnusedKeys({
        params: {},
        projectAppLocation: projectAppLocation[projectName],
        i18nFileBaseLocation: i18nFileBaseLocation[projectName],
      });
      const unusedKeysEnd = new Date().getTime();
      console.log(`-- Done. Took ${unusedKeysEnd - unusedKeysStart}ms`);

      console.log(`* Fetching active git branch`);
      const gitBranchStart = new Date().getTime();
      this.storage[projectName].branch = this.getBranch({
        projectGitLocation: projectGitLocation[projectName],
      });
      const gitBranchEnd = new Date().getTime();
      console.log(`-- Done. Took ${gitBranchEnd - gitBranchStart}ms`);

    });
    console.log(``);
    console.log(`Cache built successfully`);
  }

  public buildKeys({ root, dataNode, langRef, langData }): void {

    if (!dataNode) {
      return;
    }

    if (this.isString(dataNode)) {

      const existingKey = langData.find(elem => elem.key === root);

      if (existingKey) {
        langData.find(elem => elem.key === root).value[langRef] = dataNode;
      } else {
        const value = {};
        value[langRef] = dataNode;
        langData.push({
          key: root,
          value,
        });
      }

    } else {
      Object.keys(dataNode).forEach(key => {
        const rootKey = root ? `${root}.` : '';
        this.buildKeys({
          root: `${rootKey}${key}`,
          dataNode: dataNode[key],
          langRef,
          langData,
        });
      });
    }
  }

  public getUnusedKeys(req): object {
    const result = {};
    const fileNames = this.fromDir(req.projectAppLocation, /\.(ts|html|js)$/);
    const langRefs = req.params.langRef ? [req.params.langRef] : availableLangs;

    for (let i = 0; i < langRefs.length; i++) {
      result[langRefs[i]] = [];
      const i18nFileContent = JSON.parse(fs.readFileSync(path.join(req.i18nFileBaseLocation, `${langRefs[i].toLowerCase()}.json`)).toString('UTF-8'));
      const objectPaths = this.objectPath(i18nFileContent);

      objectPaths.forEach((
        i18nPath => {
          let matched = false;
          fileNames.forEach(filename => {
            if (matched) {
              return;
            }
            const fileContent = fs.readFileSync(filename).toString('UTF-8');
            matched = fileContent.indexOf(i18nPath) > -1;
          });
          if (!matched) {
            result[langRefs[i]].push(i18nPath);
          }
        }
      ));
    }

    return result;
  }

  public getBranch(req): string {
    const command = `git branch 2> /dev/null | sed -e '/^[^*]/d' -e "s/* \\(.*\\)/\\1/"`;
    const child = spawnSync('/bin/sh', [`-c`, command], { cwd: req.projectGitLocation });
    return child.stdout.toString().replace('\n', '');
  }

  public async pushChanges(username: string, token: string): Promise<void> {
    const branch = this.generateBranchName();
    const gitlabService = this.prepareGitlabConnection(username, token);

    await gitlabService.Branches.create(GITLAB.PROJECT_ID, branch, GITLAB.TARGET_BRANCH);
    await gitlabService.Commits.create(GITLAB.PROJECT_ID, branch, this.commitMessage, this.generateCommitActions());
    await gitlabService.MergeRequests.create(GITLAB.PROJECT_ID, branch, GITLAB.TARGET_BRANCH, this.mergeRequestTitle);
  }

  public async isAuthorizedForGitlabProject(username: string, token: string): Promise<boolean> {
    const gitlabService = this.prepareGitlabConnection(username, token);
    const project = await gitlabService.Projects.show(GITLAB.PROJECT_ID);

    if (!project) {
      return false;
    }

    return project.permissions.project_access.access_level >= 30;
  }

  public createObjectFromKeys({ data, result }): void {

    for (const langRef in result) {
      if (result.hasOwnProperty(langRef)) {
        const obj = {};
        data.forEach(elem => {
          const val = elem.value[langRef];
          const objPath = elem.key.split('.');
          objPath.reduce((prevVal, currentVal, index) => {
            if (!prevVal[currentVal]) {
              prevVal[currentVal] = {};
              if (index === objPath.length - 1) {
                prevVal[currentVal] = val;
              }
            }
            return prevVal[currentVal];
          }, obj);

        });
        result[langRef] = { ...result[langRef], ...obj };

      }
    }
  }

  private prepareGitlabConnection(username: string, token: string): typeof Gitlab {
    return new Gitlab({
      url: 'https://git.thm.de',
      token: LoginDAO.getGitlabTokenForUser(username, token),
    });
  }

  private generateCommitActions(): Array<IGitlabCommitAction> {
    return Object.keys(LANGUAGES).map(langKey => this.generateCommitActionForFile(langKey));
  }

  private generateCommitActionForFile(langKey): IGitlabCommitAction {
    return {
      action: <ICommitAction>COMMIT_ACTION.UPDATE,
      file_path: `assets/i18n/${langKey.toLowerCase()}.json`,
      content: fs.readFileSync(path.join(staticStatistics.pathToAssets, 'i18n', `${langKey.toLowerCase()}.json`)).toString('UTF-8'),
    };
  }

  private generateBranchName(): string {
    return `i18n-change_${Math.random()}`;
  }

  private fromDir(startPath, filter): Array<string> {
    if (!fs.existsSync(startPath)) {
      console.log('no dir ', startPath);
      return;
    }

    let result = [];

    const files = fs.readdirSync(startPath);
    for (let i = 0; i < files.length; i++) {
      const filename = path.join(startPath, files[i]);
      const stat = fs.lstatSync(filename);
      if (stat.isDirectory()) {
        result = result.concat(this.fromDir(filename, filter));
      } else if (filter.test(filename)) {
        result.push(filename);
      }
    }
    return result;
  }

  private objectPath(obj, currentPath = ''): Array<string> {
    let localCurrentPath = currentPath;
    let result = [];

    if (localCurrentPath.length) {
      localCurrentPath = localCurrentPath + '.';
    }
    for (const prop in obj) {
      if (obj.hasOwnProperty(prop)) {
        if (typeof obj[prop] === 'object') {
          result = result.concat(this.objectPath(obj[prop], localCurrentPath + prop));
        } else {
          result.push(localCurrentPath + prop);
        }
      }
    }
    return result;
  }

  private isString(data): boolean {
    return typeof data === 'string';
  }
}

export default I18nDAO.getInstance();
