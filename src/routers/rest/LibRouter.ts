import { SHA256 } from 'crypto-js';
import * as Hex from 'crypto-js/enc-hex';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as https from 'https';
import * as mjAPI from 'mathjax-node';
import { Document } from 'mongoose';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import {
  BadRequestError,
  BodyParam,
  ContentType,
  Get,
  InternalServerError,
  JsonController,
  NotFoundError,
  Param,
  Params,
  Post,
  Req,
  Res,
  UnauthorizedError,
} from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import * as xml2js from 'xml2js';
import AssetDAO from '../../db/AssetDAO';
import CasDAO from '../../db/CasDAO';
import MathjaxDAO from '../../db/MathjaxDAO';
import QuizDAO from '../../db/QuizDAO';
import UserDAO from '../../db/UserDAO';
import { MessageProtocol, StatusProtocol } from '../../enums/Message';
import { IMessage } from '../../interfaces/communication/IMessage';
import { ICasData } from '../../interfaces/users/ICasData';
import { asyncForEach } from '../../lib/async-for-each';
import { MatchAssetCachedQuiz } from '../../lib/cache/assets';
import { TwitterCard } from '../../lib/social-media/twitter/twitter-card';
import { UserModelItem } from '../../models/UserModelItem/UserModel';
import { AuthService } from '../../services/AuthService';
import LoggerService from '../../services/LoggerService';
import { settings, staticStatistics } from '../../statistics';
import { AbstractRouter } from './AbstractRouter';

const casSettings = { base_url: 'https://cas.thm.de/cas' };

@JsonController('/lib')
export class LibRouter extends AbstractRouter {

  constructor() {
    super();

    mjAPI.start();
    mjAPI.config({
      displayMessages: false, // determines whether Message.Set() calls are logged
      displayErrors: false, // determines whether error messages are shown on the console
      undefinedCharError: false, // determines whether "unknown characters" (i.e., no glyph in the configured fonts) are saved in the error array
      extensions: '', // a convenience option to add MathJax extensions
      fontURL: 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.2/fonts/HTML-CSS', // for webfont urls in the CSS for HTML output
      MathJax: { // default MathJax config
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
          inlineMath: [['$', '$']],
          displayMath: [['$$', '$$']],
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

  @Get('/mathjax/example/third') @ContentType('image/svg+xml')
  public getThirdMathjaxExample(): Promise<Buffer> {
    return new Promise<Buffer>(resolve => {
      fs.readFile(path.join(staticStatistics.pathToAssets, 'images', 'mathjax', 'example_3.svg'), (err, data: Buffer) => {
        resolve(data);
      });
    });
  }

  @Post('/mathjax')
  public async renderMathjax(
    @BodyParam('mathjax') mathjax: string, //
    @BodyParam('format') format: string, //
    @BodyParam('output') output: string, //
  ): Promise<object> {

    if (!mathjax || !format || !output) {
      throw new InternalServerError(`Malformed request received -> ${mathjax}, ${format}, ${output}`);
    }

    const mathjaxArray: Array<string> = [];
    const result = [];

    mathjaxArray.push(...JSON.parse(mathjax));
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

    await asyncForEach(mathjaxArray, async mathjaxPlain => {
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
    });

    return result;
  }

  @Post('/image/quiz')
  public async renderImage(@BodyParam('html') htmlContent: string, @BodyParam('theme') theme: string): Promise<string> {
    const digest = Hex.stringify(SHA256(`${htmlContent}-${theme}`));

    if (await AssetDAO.getAssetByDigest(digest)) {
      return digest;
    }

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: settings.chromiumPath,
    });
    const page = await browser.newPage();
    await page.setViewport({
      width: 1200,
      height: 675,
      deviceScaleFactor: 1,
    });
    await page.setContent(htmlContent);
    await Promise.all([
      page.addStyleTag({ path: path.join(staticStatistics.pathToAssets, 'css', 'gfm.css') }),
      page.addStyleTag({ url: `https://staging.arsnova.click/theme-${theme ?? 'default'}.css` }),
    ]);
    return new Promise(resolve => {
      setTimeout(async () => {
        const data = await page.screenshot({ type: 'png' });
        await browser.close();

        await AssetDAO.addAsset({
          mimeType: 'image/png',
          digest,
          data: data,
          url: '',
        });

        resolve(digest);
      }, 1000);
    });
  }

  @Get('/cache/quiz/assets/:digest')
  public async getCache(@Param('digest') digest: string, @Res() response: Response): Promise<ArrayBufferLike> {
    const doc = await AssetDAO.getAssetByDigestAsLean(digest);
    if (!doc || !doc.data) {
      throw new NotFoundError(`Malformed request received -> ${digest}`);
    }

    response.contentType(doc.mimeType);

    return doc.data.buffer;
  }

  @Get('/quiz/twitterPost/:digest/:quizname') //
  @ContentType('text/html')
  public async postToTwitter(@Param('digest') digest: string, @Param('quizname') quizname: string, @Res() res: ICustomI18nResponse): Promise<string> {
    return new TwitterCard(res.__mf).buildCard(`${staticStatistics.rewriteAssetCacheUrl}/lib/cache/quiz/assets/${digest}`, quizname);
  }

  @Get('/authorize/:ticket?') //
  @OpenAPI({
    summary: 'Authorizes a cas user by a ticket',
    deprecated: true,
    parameters: [
      {
        name: 'ticket',
        in: 'path',
        required: false,
      },
    ],
  })
  public authorize(
    @Params() params: { [key: string]: any }, //
    @Req() req: Request, //
    @Res() res: Response, //
  ): Promise<object> {

    const ticket = params.ticket;
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
            LoggerService.info('received response from cas server', err.message, result);
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
    @BodyParam('username', { required: false }) username: string,
    @BodyParam('passwordHash', { required: false }) password: string,
    @BodyParam('tokenHash', { required: false }) tokenHash: string,
    @BodyParam('token', { required: false }) token: string,
  ): Promise<IMessage> {

    let user: Document & UserModelItem;
    if (username) {
      user = await UserDAO.getUser(username);

      if (!password || !user || !(
        await UserDAO.validateUser(username, password)
      )) {
        throw new UnauthorizedError(JSON.stringify({
          status: StatusProtocol.Failed,
          step: MessageProtocol.AuthenticateStatic,
          payload: { reason: 'UNKOWN_LOGIN' },
        }));
      }

    } else if (tokenHash) {
      user = await UserDAO.getUserByTokenHash(tokenHash);

      if (!user) {
        throw new UnauthorizedError(JSON.stringify({
          status: StatusProtocol.Failed,
          step: MessageProtocol.AuthenticateStatic,
          payload: { reason: 'UNKOWN_LOGIN' },
        }));
      }

    } else {
      throw new UnauthorizedError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.AuthenticateStatic,
        payload: { reason: 'UNKOWN_LOGIN' },
      }));
    }

    if (!token || typeof token !== 'string' || token.length === 0) {
      token = await AuthService.generateToken(user);
      await UserDAO.updateUser(user.id, { token });
      const quizzes = await QuizDAO.getQuizzesByPrivateKey(user.privateKey) || [];
      const parsedQuizzes = await Promise.all(quizzes.map(quiz => MatchAssetCachedQuiz(quiz.toJSON())));

      return {
        status: StatusProtocol.Success,
        step: MessageProtocol.AuthenticateStatic,
        payload: {
          token,
          quizzes: parsedQuizzes,
        },
      };
    }

    const isTokenValid = await UserDAO.validateTokenForUser(username, token);
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
  private async validateToken(@Param('username') username: string, @Param('token') token: string): Promise<IMessage> {

    if (!(
      await UserDAO.validateTokenForUser(username, token)
    )) {
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
}
