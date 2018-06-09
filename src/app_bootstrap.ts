declare function require(name: string);

import * as fs from 'fs';
import * as path from 'path';
import { staticStatistics } from './statistics';

const homedir = require('os').homedir();

function createPath(basePath, pathRelativeToBase) {
  const exists = fs.existsSync(path.join(basePath, pathRelativeToBase));
  if (!exists) {
    fs.mkdir(path.join(basePath, pathRelativeToBase), (err) => console.log(err));
  }
}

function createAssetPath(pathRelativeToBase) {
  createPath(staticStatistics.pathToAssets, pathRelativeToBase);
}

function createCachePath(pathRelativeToBase) {
  createPath(staticStatistics.pathToCache, pathRelativeToBase);
}

export function createHomePath() {
  const pathToOutput = path.join(homedir, '.arsnova-click-v2-backend');
  if (!fs.existsSync(pathToOutput)) {
    fs.mkdirSync(pathToOutput);
  }
}

export function createDefaultPaths(): void {
  createCachePath('');
  createHomePath();
}
