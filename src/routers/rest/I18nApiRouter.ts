import { COMMUNICATION_PROTOCOL } from 'arsnova-click-v2-types/dist/communication_protocol';
import * as fs from 'fs';
import * as path from 'path';
import { BadRequestError, BodyParam, Get, JsonController, NotFoundError, Param, Post, Put, UnauthorizedError } from 'routing-controllers';
import I18nDAO from '../../db/I18nDAO';
import LoginDAO from '../../db/LoginDAO';
import { getProjectMetadata } from '../../lib/projectMetaData';
import { availableLangs } from '../../statistics';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/plugin/i18nator')
export class I18nApiRouter extends AbstractRouter {

  @Get('/')
  private getAll(): object {
    return {};
  }

  @Post('/:project/authorized')
  private isAuthorized(
    @BodyParam('username') username: string, //
    @BodyParam('token') token: string,
  ): object {

    const isAuthorized = I18nDAO.isAuthorizedForGitlabProject(username, token);

    if (isAuthorized) {
      return {
        status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
        step: COMMUNICATION_PROTOCOL.AUTHORIZATION.AUTHORIZED,
      };
    } else {
      throw new BadRequestError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.AUTHORIZATION.NOT_AUTHORIZED,
        payload: { reason: 'UNKOWN_LOGIN' },
      }));
    }
  }

  @Put('/:project/pushChanges')
  private pushChanges(
    @BodyParam('username') username: string, //
    @BodyParam('token') token: string,
  ): object {

    if (!LoginDAO.validateTokenForUser(username, token)) {
      return {
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.AUTHORIZATION.AUTHENTICATE_STATIC,
        payload: { reason: 'UNKOWN_LOGIN' },
      };
    }

    return I18nDAO.pushChanges(username, token);
  }

  @Get('/:project/langFile')
  private getLangFile( //
    @Param('project') project: string, //
  ): object {

    const payload = {
      langData: {},
      unused: {},
      branch: {},
    };
    const metaData = getProjectMetadata(project);

    if (!I18nDAO.storage[metaData.projectCache].langData) {
      const langData = [];
      availableLangs.forEach((langRef, index) => {
        I18nDAO.buildKeys({
          root: '',
          dataNode: JSON.parse(fs.readFileSync(path.join(metaData.i18nFileBaseLocation, `${langRef.toLowerCase()}.json`)).toString('UTF-8')),
          langRef,
          langData,
        });
      });
      I18nDAO.storage[metaData.projectCache].langData = langData;
    }
    payload.langData = I18nDAO.storage[metaData.projectCache].langData;

    if (!I18nDAO.storage[metaData.projectCache].unused) {
      I18nDAO.storage[metaData.projectCache].unused = I18nDAO.getUnusedKeys(metaData, null);
    }
    payload.unused = I18nDAO.storage[metaData.projectCache].unused;

    if (!I18nDAO.storage[metaData.projectCache].branch) {
      I18nDAO.storage[metaData.projectCache].branch = I18nDAO.getBranch(metaData);
    }
    payload.branch = I18nDAO.storage[metaData.projectCache].branch;

    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      payload,
    };
  }

  @Post('/:project/updateLang')
  private updateLang(
    @Param('project') project: string, //
    @BodyParam('username') username: string, //
    @BodyParam('token') token: string, //
    @BodyParam('data') data: string,
  ): object {

    if (!LoginDAO.validateTokenForUser(username, token)) {
      throw new UnauthorizedError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.AUTHORIZATION.AUTHENTICATE_STATIC,
        payload: { reason: 'UNKOWN_LOGIN' },
      }));
    }

    if (!data) {
      throw new BadRequestError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.I18N.INVALID_DATA,
        payload: {
          username,
          token,
          data,
        },
      }));
    }

    const result = {
      en: {},
      de: {},
      es: {},
      fr: {},
      it: {},
    };
    const langKeys = Object.keys(result);
    I18nDAO.createObjectFromKeys({
      data,
      result,
    });
    const metaData = getProjectMetadata(project);

    I18nDAO.storage[metaData.projectCache].langData = data;

    let succeeded = false;

    langKeys.forEach((langRef, index) => {
      const fileContent = result[langRef];
      const fileLocation = path.join(metaData.i18nFileBaseLocation, `${langRef.toLowerCase()}.json`);
      const exists = fs.existsSync(fileLocation);
      if (!exists) {
        return;
      }
      fs.writeFileSync(fileLocation, JSON.stringify(fileContent));
      if (index === langKeys.length - 1) {
        succeeded = true;
      }
    });

    if (succeeded) {
      return { status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL };
    } else {
      throw new NotFoundError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.I18N.FILE_NOT_FOUND,
        payload: {},
      }));
    }
  }
}
