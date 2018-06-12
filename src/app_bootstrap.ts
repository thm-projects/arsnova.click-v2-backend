declare function require(name: string): any;

import * as fs from 'fs';
import * as path from 'path';
import { staticStatistics } from './statistics';

const homedir = require('os').homedir();

function createPath(basePath, pathRelativeToBase): void {
  const exists = fs.existsSync(path.join(basePath, pathRelativeToBase));
  if (!exists) {
    fs.mkdir(path.join(basePath, pathRelativeToBase), (err) => console.log('app_bootstrap:createPathError', err));
  }
}

function createAssetPath(pathRelativeToBase): void {
  createPath(staticStatistics.pathToAssets, pathRelativeToBase);
}

function createCachePath(pathRelativeToBase): void {
  createPath(staticStatistics.pathToCache, pathRelativeToBase);
}

export function createHomePath(): void {
  const pathToOutput = path.join(homedir, '.arsnova-click-v2-backend');
  if (!fs.existsSync(pathToOutput)) {
    fs.mkdirSync(pathToOutput);
  }
}

export function createDefaultPaths(): void {
  createCachePath('');
  createHomePath();
}
