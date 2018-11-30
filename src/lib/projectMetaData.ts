import { IProjectMetaData } from '../interfaces/IProjectMetaData';
import { i18nFileBaseLocation, projectAppLocation, projectBaseLocation, projectGitLocation } from '../statistics';

export function getProjectMetadata(project: string): IProjectMetaData {
  return {
    i18nFileBaseLocation: i18nFileBaseLocation[project],
    projectBaseLocation: projectBaseLocation[project],
    projectAppLocation: projectAppLocation[project],
    projectGitLocation: projectGitLocation[project],
    projectCache: project,
  };
}
