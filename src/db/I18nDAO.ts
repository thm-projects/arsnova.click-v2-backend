import * as Gitlab from 'gitlab';
import { Branch, CommitAction, GitlabProject, Language } from '../enums/Enums';
import { ICommitAction, IGitlabCommitAction } from '../interfaces/gitlab/apiv4';
import { generateToken } from '../lib/generateToken';
import LoggerService from '../services/LoggerService';
import { availableLangs } from '../statistics';
import { AbstractDAO } from './AbstractDAO';

class I18nDAO extends AbstractDAO<object> {

  private readonly mergeRequestTitle = 'WIP: Update i18n keys';
  private readonly commitMessage = 'Updates i18n keys';
  private readonly gitlabAccessToken = process.env.GITLAB_TOKEN;

  constructor(storage: object) {
    super(storage);
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

  public async cacheUpdateRequired(project: GitlabProject): Promise<boolean> {
    if (!this.storage[project].lastUpdate || !this.storage[project].langData || !this.storage[project].unused) {
      return true;
    }

    const gitlabService: Gitlab = this.prepareGitlabConnection();
    const commits = await gitlabService.Commits.all(project, {
      since: this.storage[project].lastUpdate.toISOString(),
    });

    return commits.length > 0;
  }

  public reloadCache(): Promise<void> {
    return new Promise(resolve => {
      Object.values(this.storage).forEach(async (project, index, array) => {
        const gitlabProject = project['name'] === 'arsnova-click-v2-backend' ? GitlabProject['arsnova-click-v2-backend']
                                                                             : GitlabProject['arsnova-click-v2-frontend'];

        const updateRequired = await this.cacheUpdateRequired(gitlabProject);
        if (!updateRequired) {
          resolve();
          return;
        }

        const langDataStart = new Date().getTime();
        this.storage[gitlabProject].langData = await this.getI18nFileContentFromRepo(gitlabProject);
        const langDataEnd = new Date().getTime();
        LoggerService.info(`Built language data for ${project['name']} in ${langDataEnd - langDataStart}ms`);

        const unusedKeysStart = new Date().getTime();
        this.storage[gitlabProject].unused = await this.getUnusedI18nKeysFromSourceFiles(gitlabProject, this.storage[gitlabProject].langData);
        const unusedKeysEnd = new Date().getTime();
        LoggerService.info(`Built unused keys for ${project['name']} in ${unusedKeysEnd - unusedKeysStart}ms`);

        this.storage[gitlabProject].lastUpdate = new Date();

        if (index === array.length - 1) {
          resolve();
        }
      });
    });
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
    const gitlabService: Gitlab = this.prepareGitlabConnection(token);

    await gitlabService.Branches.create(project, branch, Branch.TargetBranch);
    await gitlabService.Commits.create(project, branch, this.commitMessage, this.generateCommitActions(project, data));
    await gitlabService.MergeRequests.create(project, branch, Branch.TargetBranch, this.mergeRequestTitle);
  }

  public async getUnusedI18nKeysFromSourceFiles(project: GitlabProject, i18nContent: { [key: string]: any }): Promise<Array<any>> {
    const gitlabService = this.prepareGitlabConnection();

    const filter = /\.(ts|html|js)$/;
    const negativeFilter = /(spec|test|po|mock|pipe|module|config|conf|karma|environment|assets|adapter)\./;
    const fileContents = ((await gitlabService.Repositories.tree(project, {
      recursive: true,
      ref: Branch.TargetBranch,
    })).filter(val => val.type === 'blob' && val.name.match(filter)).filter(val => !val.name.match(negativeFilter)));

    let fileData = [];
    while (fileContents.length > 0) {
      fileData = fileData.concat(...await Promise.all<any>(fileContents.splice(0, 50).map(val => {
        return gitlabService.RepositoryFiles.showRaw(project, `${val.path}`, Branch.TargetBranch).catch(rejected => LoggerService.error(rejected));
      }))).filter(val => !!val);
    }

    return Object.values(i18nContent).map(val => val.key).filter(i18nPath => {
      return !fileData.some(fileContent => fileContent.includes(i18nPath));
    });

  }

  public getI18nFileContentFromRepo(project: GitlabProject): Promise<Array<any>> {
    const gitlabService = this.prepareGitlabConnection();

    return new Promise<Array<any>>(resolve => {
      const langData = [];

      availableLangs.forEach(async (langRef, index) => {
        const dataNode = await gitlabService.RepositoryFiles.showRaw(project, `${this.buildI18nBasePath(project)}/${langRef.toLowerCase()}.json`,
          Branch.TargetBranch);

        this.buildKeys({
          root: '',
          dataNode,
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

    return remoteProject.permissions.project_access.access_level >= 30;
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

  private prepareGitlabConnection(token?: string): typeof Gitlab {
    return new Gitlab.default({
      url: 'https://git.thm.de',
      token: token || this.gitlabAccessToken,
    });
  }

  private generateCommitActions(project: GitlabProject, data: object): Array<IGitlabCommitAction> {
    return Object.values(Language).map(langKey => this.generateCommitActionForFile(project, langKey, data[langKey]));
  }

  private generateCommitActionForFile(project: GitlabProject, langKey: string, data: object): IGitlabCommitAction {
    return {
      action: <ICommitAction>CommitAction.Update,
      file_path: `${this.buildI18nBasePath(project)}/${langKey.toLowerCase()}.json`,
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
