import { Authorized, BodyParam, Get, HeaderParam, InternalServerError, JsonController, Param, Post } from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import I18nDAO from '../../db/I18nDAO';
import { GitlabProject, Language } from '../../enums/Enums';
import { StatusProtocol } from '../../enums/Message';
import { UserRole } from '../../enums/UserRole';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/plugin/i18nator')
export class I18nApiRouter extends AbstractRouter {

  @Post('/:project/updateLang') //
  @Authorized(UserRole.EditI18n) //
  @OpenAPI({
    summary: 'Updates the language keys for a project',
    security: [{ bearerAuth: [] }],
  })
  private async updateLang(
    @Param('project') project: string, //
    @BodyParam('gitlabToken') gitlabToken: string, //
    @BodyParam('data') data: string,
  ): Promise<object> {

    const result = {};
    Object.values(Language).forEach(langKey => result[langKey] = {});

    I18nDAO.createObjectFromKeys({
      data,
      result,
    });

    try {
      await I18nDAO.pushChanges(GitlabProject[project], gitlabToken, result);
      return { status: StatusProtocol.Success };
    } catch (e) {
      throw e;
    }
  }

  @Get('/:project/langFile') //
  @Authorized(UserRole.EditI18n) //
  @OpenAPI({
    summary: 'Returns the language file for a project',
    security: [{ bearerAuth: [] }],
  })
  private async getLangFile( //
    @HeaderParam('authorization') token: string, //
    @Param('project') project: string, //
  ): Promise<object> {
    const payload = {
      langData: {},
      unused: {},
    };

    try {
      await I18nDAO.reloadCache();
    } catch (e) {
      return new InternalServerError(e);
    }

    payload.langData = I18nDAO.storage[GitlabProject[project]].langData;
    payload.unused = I18nDAO.storage[GitlabProject[project]].unused;

    return {
      status: StatusProtocol.Success,
      payload,
    };
  }
}
