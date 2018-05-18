import * as fs from 'fs';
import * as path from 'path';
import {staticStatistics} from './statistics';

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

export function createDefaultPaths(): void {
  createCachePath('');
}
