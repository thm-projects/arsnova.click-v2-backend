import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { availableLangs, i18nFileBaseLocation, projectAppLocation, projectGitLocation } from '../statistics';
import { AbstractDAO } from './AbstractDAO';

class I18nDAO extends AbstractDAO<object> {

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
      availableLangs.forEach((langRef, index) => {
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
      const i18nFileContent = JSON.parse(fs.readFileSync(path.join(req.i18nFileBaseLocation, `${langRefs[i]}.json`)).toString('UTF-8'));
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
