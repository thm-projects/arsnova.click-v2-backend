import * as crypto from 'crypto';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as https from 'https';
import * as mjAPI from 'mathjax-node';
import * as MessageFormat from 'messageformat';
import * as path from 'path';
import {
  BadRequestError, BodyParam, Get, InternalServerError, JsonController, NotFoundError, Param, Post, Req, Res, UnauthorizedError,
} from 'routing-controllers';
import * as xml2js from 'xml2js';
import CasDAO from '../../db/CasDAO';
import DbDAO from '../../db/DbDAO';
import MathjaxDAO from '../../db/MathjaxDAO';
import QuizDAO from '../../db/quiz/QuizDAO';
import UserDAO from '../../db/UserDAO';
import { AbstractAnswerEntity } from '../../entities/answer/AbstractAnswerEntity';
import { DbCollection } from '../../enums/DbOperation';
import { MessageProtocol, StatusProtocol } from '../../enums/Message';
import { ILinkImage } from '../../interfaces/assets';
import { IQuizSerialized } from '../../interfaces/quizzes/IQuizEntity';
import { ICasData } from '../../interfaces/users/ICasData';
import { MatchTextToAssetsDb } from '../../lib/cache/assets';
import { AuthService } from '../../services/AuthService';
import LoggerService from '../../services/LoggerService';
import { staticStatistics } from '../../statistics';
import { AbstractRouter } from './AbstractRouter';
import FileType = require('file-type');

const derivates: Array<string> = require('../../assets/imageDerivates');
const themeData = JSON.parse(fs.readFileSync(path.join(staticStatistics.pathToAssets, 'themeData.json')).toString());
const casSettings = { base_url: 'https://cas.thm.de/cas' };

@JsonController('/lib')
export class LibRouter extends AbstractRouter {

  constructor() {
    super();

    mjAPI.start();
    mjAPI.config({
      // determines whether Message.Set() calls are logged
      displayMessages: false, // determines whether error messages are shown on the console
      displayErrors: false, // determines whether "unknown characters" (i.e., no glyph in the configured fonts) are saved in the error array
      undefinedCharError: false, // a convenience option to add MathJax extensions
      extensions: '', // for webfont urls in the CSS for HTML output
      fontURL: 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.2/fonts/HTML-CSS', // default MathJax config
      MathJax: {
        jax: ['input/TeX', 'input/MathML', 'input/AsciiMath', 'output/CommonHTML'],
        extensions: [
          'tex2jax.js', 'mml2jax.js', 'asciimath2jax.js', 'AssistiveMML.js',
        ],
        TeX: {
          extensions: ['AMSmath.js', 'AMSsymbols.js', 'noErrors.js', 'noUndefined.js', 'autoload-all.js', 'color.js'],
        },
        tex2jax: {
          processEscapes: true,
          processEnvironments: true,
          inlineMath: [['$', '$'], ['\\(', '\\)']],
          displayMath: [['$$', '$$'], ['\\[', '\\]']],
        },
      },
    });
  }

  @Get('/')
  public getAll(): object {
    return {
      paths: [
        {
          name: '/mathjax',
          description: 'Returns the rendered output of a given mathjax string',
        }, {
          name: '/mathjax/example/first',
          description: 'Returns the rendered output of an example mathjax MathMl string as svg',
        }, {
          name: '/mathjax/example/second',
          description: 'Returns the rendered output of an example mathjax TeX string as svg',
        }, {
          name: '/mathjax/example/third',
          description: 'Returns the rendered output of an example mathjax TeX string as svg',
        }, {
          name: '/storage/quiz/assets',
          description: 'Parses the quiz content and caches all external resources',
        }, {
          name: '/authorize',
          description: 'Handles authentication via CAS',
        },
      ],
    };
  }

  @Get('/linkImages/:theme?')
  public getLinkImages(@Param('theme') theme: string): Array<ILinkImage> {

    if (!theme) {
      theme = 'theme-Material';
    }

    const basePath = `/assets/images/theme/${theme}`;
    const manifestPath = `${staticStatistics.rewriteAssetCacheUrl}/lib/manifest/${theme}`;

    const result: Array<ILinkImage> = [
      {
        tagName: 'link',
        className: 'theme-meta-data',
        rel: 'manifest',
        id: 'link-manifest',
        href: `${manifestPath}`,
        type: 'image/png',
      }, {
        tagName: 'link',
        className: 'theme-meta-data',
        rel: 'apple-touch-icon',
        id: 'link-apple-touch-default',
        href: `${basePath}/logo_s32x32.png`,
        type: 'image/png',
      }, {
        tagName: 'link',
        className: 'theme-meta-data',
        rel: 'apple-touch-icon-precomposed',
        id: 'link-apple-touch-precomposed-default',
        href: `${basePath}/logo_s32x32.png`,
        type: 'image/png',
      }, {
        tagName: 'meta',
        className: 'theme-meta-data',
        name: 'theme-color',
        id: 'meta-theme-color',
        content: `${themeData[theme].exportedAtRowStyle.bg}`,
      }, {
        tagName: 'meta',
        className: 'theme-meta-data',
        name: 'msapplication-TileColor',
        id: 'meta-tile-color',
        content: `${themeData[theme].exportedAtRowStyle.bg}`,
      }, {
        tagName: 'meta',
        className: 'theme-meta-data',
        name: 'msapplication-TileImage',
        id: 'meta-tile-image',
        content: `${basePath}/logo_s144x144.png`,
        type: 'image/png',
      },
    ];

    derivates.forEach(derivate => {
      result.push({
        tagName: 'link',
        className: 'theme-meta-data',
        rel: 'icon',
        href: `${basePath}/logo_s${derivate}.png`,
        id: `link-icon-${derivate}`,
        sizes: derivate,
        type: 'image/png',
      }, {
        tagName: 'link',
        className: 'theme-meta-data',
        rel: 'apple-touch-icon-precomposed',
        href: `${basePath}/logo_s${derivate}.png`,
        id: `link-apple-touch-precomposed-${derivate}`,
        sizes: derivate,
        type: 'image/png',
      });
    });

    result.push({
      tagName: 'link',
      className: 'theme-meta-data',
      rel: 'shortcut icon',
      sizes: '64x64',
      id: 'link-favicon',
      href: `${basePath}/logo_s64x64.png`,
      type: 'image/png',
    });

    return result;
  }

  @Get('/favicon/:theme?')
  public getFavicon(
    @Param('theme') theme: string, //
    @Res() res: Response, //
  ): Promise<object> {

    if (!theme) {
      theme = 'theme-Material';
    }

    let filePath = path.join(staticStatistics.pathToAssets, 'images', 'theme', `${theme}`, `logo_s64x64.png`);
    const exists = fs.existsSync(filePath);

    if (!exists) {
      filePath = path.join(staticStatistics.pathToAssets, 'images', 'logo_transparent.png');
    }

    return new Promise<Buffer>(resolve => {
      fs.readFile(filePath, (err, data: Buffer) => {
        res.contentType(FileType(data).mime);
        resolve(data);
      });
    });
  }

  @Get('/manifest/:theme?')
  public getManifest(
    @Param('theme') theme: string, //
    @Res() res: I18nResponse, //
    @Req() req: Request, //
  ): object {

    if (!theme) {
      theme = 'theme-Material';
    }

    const mf: MessageFormat.Msg = res.__mf;
    const basePath = req.header('Origin');

    const manifest = {
      short_name: 'arsnovaClick',
      name: 'arsnova.click',
      description: mf('manifest.description'),
      background_color: themeData[theme].exportedAtRowStyle.bg,
      theme_color: themeData[theme].exportedAtRowStyle.bg,
      start_url: `${basePath}`,
      display: 'standalone',
      orientation: 'portrait',
      icons: [],
    };

    derivates.forEach((derivate) => {
      manifest.icons.push({
        src: `${basePath}/assets/images/theme/${theme}/logo_s${derivate}.png`,
        sizes: derivate,
        type: 'image/png',
      });
    });

    return manifest;
  }

  @Get('/mathjax/example/first')
  public getFirstMathjaxExample(): object {
    return new Promise<object>((resolve, reject) => {
      mjAPI.typeset({
        math: `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" mathcolor="black">
  <mrow>
    <mi>f</mi>
    <mrow>
      <mo>(</mo>
      <mi>a</mi>
      <mo>)</mo>
    </mrow>
  </mrow>
  <mo>=</mo>
  <mrow>
    <mfrac>
      <mn>1</mn>
      <mrow>
        <mn>2</mn>
        <mi>&#x3C0;</mi>
        <mi>i</mi>
      </mrow>
    </mfrac>
    <msub>
      <mo>&#x222E;</mo>
      <mrow>
        <mi>&#x3B3;</mi>
      </mrow>
    </msub>
    <mfrac>
      <mrow>
        <mi>f</mi>
        <mo>(</mo>
        <mi>z</mi>
        <mo>)</mo>
      </mrow>
      <mrow>
        <mi>z</mi>
        <mo>&#x2212;</mo>
        <mi>a</mi>
      </mrow>
    </mfrac>
    <mi>d</mi>
    <mi>z</mi>
  </mrow>
</math>`,
        format: 'MathML', // 'inline-TeX', 'MathML'
        svg: true, //  svg:true, mml: true
      }, data => {
        if (data.errors) {
          reject(data.errors);
        } else {
          resolve(data);
        }
      });
    });
  }

  @Get('/mathjax/example/second')
  public getSecondMathjaxExample(): Promise<object> {
    return new Promise<object>((resolve, reject) => {
      mjAPI.typeset({
        math: `\\begin{align} a_1& =b_1+c_1\\\\ a_2& =b_2+c_2-d_2+e_2 \\end{align}`,
        format: 'TeX', // 'inline-TeX', 'MathML'
        mml: true, //  svg:true, mml: true
      }, data => {
        if (data.errors) {
          reject(data.errors);
        } else {
          resolve(data);
        }
      });
    });
  }

  @Get('/mathjax/example/third')
  public getThirdMathjaxExample(): Promise<Buffer> {
    return new Promise<Buffer>(resolve => {
      fs.readFile(path.join(staticStatistics.pathToAssets, 'images', 'mathjax', 'example_3.svg'), (err, data: Buffer) => {
        resolve(data);
      });
    });
  }

  @Post('/mathjax')
  public renderMathjax(
    @BodyParam('mathjax') mathjax: string, //
    @BodyParam('format') format: string, //
    @BodyParam('output') output: string, //
  ): Promise<object> {

    if (!mathjax || !format || !output) {
      throw new InternalServerError(`Malformed request received -> ${mathjax}, ${format}, ${output}`);
    }
    const mathjaxArray: Array<string> = [];
    mathjaxArray.push(...JSON.parse(mathjax));
    const result = [];
    if (!mathjaxArray.length) {
      throw new BadRequestError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.Render,
        payload: {
          mathjax,
          format,
          mathjaxArray,
          output,
        },
      }));
    }

    return new Promise<object>(resolve => {
      mathjaxArray.forEach(async (mathjaxPlain, index) => {

        const dbResult = MathjaxDAO.getAllPreviouslyRenderedData(mathjaxPlain);
        if (dbResult) {
          result.push(dbResult);
          return;
        }

        try {
          const data = await mjAPI.typeset({
            math: mathjaxPlain.replace(/( ?\${1,2} ?)/g, ''),
            format: format,
            html: output === 'html',
            css: output === 'html',
            svg: output === 'svg',
            mml: output === 'mml',
          });

          MathjaxDAO.updateRenderedData(data, mathjaxPlain);
          result.push(data);
        } catch (e) {
          console.error('error while trying to parse mathjax', e);
        }

        if (index === mathjaxArray.length - 1) {
          resolve(result);
        }
      });
    });
  }

  @Post('/cache/quiz/assets')
  public async cacheQuizAssets(@BodyParam('quiz') quiz: IQuizSerialized): Promise<object> {

    if (!quiz) {
      throw new BadRequestError(`Malformed request received -> ${quiz}`);
    }

    const promises: Array<Promise<any>> = [];

    quiz.questionList.forEach(question => {
      promises.push(MatchTextToAssetsDb(question.questionText).then(val => question.questionText = val));
      question.answerOptionList.forEach((answerOption: AbstractAnswerEntity) => {
        promises.push(MatchTextToAssetsDb(answerOption.answerText).then(val => answerOption.answerText = val));
      });
    });

    await Promise.all<any>(promises);

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.QuizAssets,
      payload: {
        quiz,
      },
    };
  }

  @Get('/cache/quiz/assets/:digest')
  public async getCache(@Param('digest') digest: string, @Res() response: Response): Promise<Buffer> {

    const doc = await DbDAO.readOne(DbCollection.Assets, { digest });
    if (!doc || !doc.data) {
      throw new NotFoundError(`Malformed request received -> ${digest}`);
    }

    response.contentType(doc.mimeType);

    return doc.data.buffer;
  }

  @Get('/authorize/:ticket?')
  public authorize(@Param('ticket') ticket: string, @Req() req: Request, @Res() res: Response): Promise<object> {

    let serviceUrl = req.headers.referer;
    if (Array.isArray(serviceUrl)) {
      serviceUrl = serviceUrl[0];
    }
    serviceUrl = encodeURIComponent(serviceUrl.replace(`?ticket=${ticket}`, ''));

    if (!ticket) {
      const loginUrl = `${casSettings.base_url}/login?service=${serviceUrl}`;
      res.redirect(loginUrl);
      return;
    }

    return new Promise<object>(resolve => {

      const casRequest = https.get(`${casSettings.base_url}/serviceValidate?ticket=${ticket}&service=${serviceUrl}`, (casResponse) => {

        let data = '';

        casResponse.on('data', (chunk) => {
          data += chunk;
        });

        casResponse.on('end', () => {
          xml2js.parseString(data, (err, result) => {
            LoggerService.info('received response from cas server', err, result);
            if (err || result['cas:serviceResponse']['cas:authenticationFailure']) {
              throw new UnauthorizedError(JSON.stringify({
                status: StatusProtocol.Failed,
                step: MessageProtocol.Authenticate,
                payload: {
                  err,
                  result,
                },
              }));
            } else {
              const resultData = result['cas:serviceResponse']['cas:authenticationSuccess'][0]['cas:attributes'][0];
              const casDataElement: ICasData = {
                username: resultData['cas:username'],
                displayName: resultData['cas:displayNmae'],
                mail: resultData['cas:mail'],
              };
              CasDAO.add(ticket, casDataElement);
              resolve({
                status: StatusProtocol.Success,
                step: MessageProtocol.Authenticate,
                payload: { ticket },
              });
            }
          });
        });
      });

      casRequest.on('error', (error) => {
        LoggerService.info('error at requesting cas url', error.message);
        casRequest.abort();
        throw new UnauthorizedError(JSON.stringify({
          status: StatusProtocol.Failed,
          step: MessageProtocol.Authenticate,
          payload: { error },
        }));
      });

    });
  }

  @Post('/authorize/static')
  private async authorizeStatic(
    @BodyParam('username') username: string,
    @BodyParam('passwordHash') password: string,
    @BodyParam('token', { required: false }) token: string,
  ): Promise<object> {

    const user = UserDAO.getUser(username);

    if (!username || !password || !user || !UserDAO.validateUser(username, password)) {
      throw new UnauthorizedError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.AuthenticateStatic,
        payload: { reason: 'UNKOWN_LOGIN' },
      }));
    }

    if (!token || typeof token !== 'string' || token.length === 0) {
      token = await AuthService.generateToken(user);
      DbDAO.updateOne(DbCollection.Users, { _id: user.id }, { token });

      return {
        status: StatusProtocol.Success,
        step: MessageProtocol.AuthenticateStatic,
        payload: {
          token,
          quizzes: QuizDAO.getAllQuizzes().filter(quiz => quiz.privateKey === user.privateKey).map(quiz => quiz.serialize()),
        },
      };
    }

    const isTokenValid = UserDAO.validateTokenForUser(username, token);
    if (!isTokenValid) {
      throw new UnauthorizedError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.AuthenticateStatic,
        payload: { isTokenValid },
      }));
    }

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.AuthenticateStatic,
      payload: { isTokenValid },
    };
  }

  @Get('/authorize/validate/:username/:token')
  private validateToken(@Param('username') username: string, @Param('token') token: string): object {

    if (!UserDAO.validateTokenForUser(username, token)) {
      return {
        status: StatusProtocol.Failed,
        step: MessageProtocol.AuthenticateStatic,
        payload: { reason: 'UNKOWN_LOGIN' },
      };
    }

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.AuthenticateStatic,
    };
  }

  private randomValueHex(len: number = 40): string {
    return crypto.randomBytes( //
      Math.ceil((len) / 2), //
    ).toString('hex') // convert to hexadecimal format
    .slice(0, len);   // return required number of characters
  }
}
