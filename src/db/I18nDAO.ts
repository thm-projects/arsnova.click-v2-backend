import { Gitlab } from '@gitbeaker/node';
import { GitlabCommitAction, GitlabProject, Language } from '../enums/Enums';
import { IGitlabCommitAction } from '../interfaces/gitlab/apiv11';
import { asyncForEach } from '../lib/async-for-each';
import { generateToken } from '../lib/generateToken';
import LoggerService from '../services/LoggerService';
import { settings } from '../statistics';
import { AbstractDAO } from './AbstractDAO';

class I18nDAO extends AbstractDAO {
  get storage(): object {
    return this._storage;
  }

  private readonly _mergeRequestTitle = 'WIP: Update i18n keys';
  private readonly _commitMessage = 'Updates i18n keys';
  private readonly _targetBranch = settings.gitlab.targetBranch;
  private readonly _storage: object;

  constructor(storage: object) {
    super();
    this._storage = storage;
  }

  public static getInstance(): I18nDAO {
    if (!this.instance) {
      this.instance = new I18nDAO({
        [GitlabProject['arsnova-click-v2-backend']]: {
          name: 'arsnova-click-v2-backend',
          unused: null,
          langData: null,
          lastUpdate: null,
        },
        [GitlabProject['arsnova-click-v2-frontend']]: {
          name: 'arsnova-click-v2-frontend',
          unused: null,
          langData: null,
          lastUpdate: null,
        },
      });
    }
    return this.instance;
  }

  public async getStatistics(): Promise<{ [key: string]: number }> {
    return {};
  }

  public async cacheUpdateRequired(project: GitlabProject): Promise<boolean> {
    if (!this.storage[project].lastUpdate || !this.storage[project].langData || !this.storage[project].unused) {
      return true;
    }

    const gitlabService = this.prepareGitlabConnection();
    const commits = await gitlabService.Commits.all(project, {
      since: this.storage[project].lastUpdate,
    });

    return (
             commits as any
           ).length > 0;
  }

  public reloadCache(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!isNaN(settings.gitlab.frontend) || !isNaN(settings.gitlab.backend)) {
        resolve();
        return;
      }
      reject('[I18nDAO] No gitlab projects set');
    }).then(() => asyncForEach(Object.values(this.storage), async project => {
      const gitlabProject = project['name'] === 'arsnova-click-v2-backend' //
                            ? GitlabProject['arsnova-click-v2-backend'] //
                            : GitlabProject['arsnova-click-v2-frontend'];

      const updateRequired = await this.cacheUpdateRequired(gitlabProject);
      if (!updateRequired) {
        return;
      }

      const langDataStart = new Date().getTime();
      this.storage[gitlabProject].langData = await this.getI18nFileContentFromRepo(gitlabProject);
      const langDataEnd = new Date().getTime();
      LoggerService.info(`[I18nDAO] Built language data for ${project['name']} in ${langDataEnd - langDataStart}ms`);

      const unusedKeysStart = new Date().getTime();
      this.storage[gitlabProject].unused = await this.getUnusedI18nKeysFromSourceFiles(gitlabProject, this.storage[gitlabProject].langData);
      const unusedKeysEnd = new Date().getTime();
      LoggerService.info(`[I18nDAO] Built unused keys for ${project['name']} in ${unusedKeysEnd - unusedKeysStart}ms`);

      this.storage[gitlabProject].lastUpdate = new Date().toISOString();
    }));
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

  public async pushChanges(project: GitlabProject, token: string, data: object): Promise<void> {
    const isAuthorized = await this.isAuthorizedForGitlabProject(project, token);
    if (!isAuthorized) {
      return;
    }

    const branch = this.generateBranchName();
    const gitlabService = this.prepareGitlabConnection(token);

    await gitlabService.Branches.create(project, branch, this._targetBranch);
    await gitlabService.Commits.create(project, branch, this._commitMessage, this.generateCommitActions(project, data));
    await gitlabService.MergeRequests.create(project, branch, this._targetBranch, this._mergeRequestTitle,
      { remove_source_branch: true, squash: true });
  }

  public async getUnusedI18nKeysFromSourceFiles(project: GitlabProject, i18nContent: { [key: string]: any }): Promise<Array<any>> {
    const gitlabService = this.prepareGitlabConnection();

    const filter = /\.(ts|html|js)$/;
    const negativeFilter = /(spec|test|po|mock|pipe|module|config|conf|karma|environment|assets|adapter)\./;
    const fileContents = (
      (
        (
          await gitlabService.Repositories.tree(project, {
            recursive: true,
            ref: this._targetBranch,
          })
        ) as any
      ).filter(val => val.type === 'blob' && val.name.match(filter)).filter(val => !val.name.match(negativeFilter))
    );

    let fileData = [];
    while (fileContents.length > 0) {
      fileData = fileData.concat(...await Promise.all<any>(fileContents.splice(0, 50).map(val => {
        return gitlabService.RepositoryFiles.showRaw(project, `${val.path}`, this._targetBranch).catch(rejected => LoggerService.error(rejected));
      }))).filter(val => !!val);
    }

    return Object.values(i18nContent).map(val => val.key).filter(i18nPath => {
      return !fileData.some(fileContent => fileContent.includes(i18nPath));
    });

  }

  public getI18nFileContentFromRepo(project: GitlabProject): Promise<Array<any>> {
    const gitlabService = this.prepareGitlabConnection();
    const availableLangs = Object.values(Language);

    return new Promise<Array<any>>(resolve => {
      const langData = [];

      availableLangs.forEach(async (langRef, index) => {
        const dataNode = (
          await gitlabService.RepositoryFiles.showRaw(project, `${this.buildI18nBasePath(project)}/${langRef.toLowerCase()}.json`, this._targetBranch)
        ) as unknown as string;

        this.buildKeys({
          root: '',
          dataNode: JSON.parse(dataNode),
          langRef: langRef.toLowerCase(),
          langData,
        });

        if (index === availableLangs.length - 1) {
          resolve(langData);
        }
      });
    });
  }

  public async isAuthorizedForGitlabProject(project: GitlabProject, token?: string): Promise<boolean> {
    const gitlabService = this.prepareGitlabConnection(token);
    const remoteProject = await gitlabService.Projects.show(project);

    if (!remoteProject) {
      return false;
    }

    return (
             remoteProject as any
           ).permissions.project_access.access_level >= 30;
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

  public setStorageData(storage: object): void {
    Object.entries(storage).forEach(storageElem => this._storage[storageElem[0]] = storageElem[1]);
  }

  private prepareGitlabConnection(token?: string): InstanceType<typeof Gitlab> {
    return new Gitlab({
      host: settings.gitlab.host,
      token: token || settings.gitlab.loginToken,
    });
  }

  private generateCommitActions(project: GitlabProject, data: object): Array<IGitlabCommitAction> {
    return Object.values(Language).map(langKey => this.generateCommitActionForFile(project, langKey, data[langKey]));
  }

  private generateCommitActionForFile(project: GitlabProject, langKey: string, data: object): IGitlabCommitAction {
    return {
      action: GitlabCommitAction.Update,
      filePath: `${this.buildI18nBasePath(project)}/${langKey.toLowerCase()}.json`,
      content: JSON.stringify(data),
    };
  }

  private generateBranchName(): string {
    return `i18n-change_${generateToken(Math.random(), new Date().getTime())}`;
  }

  private isString(data): boolean {
    return typeof data === 'string';
  }

  private buildI18nBasePath(project: GitlabProject): string {
    switch (project) {
      case GitlabProject['arsnova-click-v2-backend']:
        return 'assets/i18n';
      case GitlabProject['arsnova-click-v2-frontend']:
        return 'src/assets/i18n';
    }
  }
}

export default I18nDAO.getInstance();
