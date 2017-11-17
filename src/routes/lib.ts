import {NextFunction, Request, Response, Router} from 'express';
import * as mjAPI from 'mathjax-node';
import {IQuestion, IQuestionGroup} from 'arsnova-click-v2-types/src/questions/interfaces';
import * as fs from 'fs';
import {IAnswerOption} from 'arsnova-click-v2-types/src/answeroptions/interfaces';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fileType from 'file-type';
import {MatchTextToAssetsDb} from '../cache/assets';
import {MathjaxDAO} from '../db/MathjaxDAO';
import {request} from 'http';
import * as xml2js from 'xml2js';
import * as https from 'https';
import {CasDAO} from '../db/CasDAO';
import {ICasData} from 'arsnova-click-v2-types/src/common';

const casSettings = {base_url: 'https://cas.thm.de/cas'};

export class LibRouter {
  get router(): Router {
    return this._router;
  }

  private _router: Router;

  /**
   * Initialize the LibRouter
   */
  constructor() {
    this._router = Router();
    this.init();

    mjAPI.start();
    mjAPI.config({
      // determines whether Message.Set() calls are logged
      displayMessages: false,
      // determines whether error messages are shown on the console
      displayErrors: true,
      // determines whether "unknown characters" (i.e., no glyph in the configured fonts) are saved in the error array
      undefinedCharError: true,
      // a convenience option to add MathJax extensions
      extensions: '',
      // for webfont urls in the CSS for HTML output
      fontURL: 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.2/fonts/HTML-CSS',
      // default MathJax config
      MathJax: {
        jax: ['input/TeX', 'input/MathML', 'input/AsciiMath', 'output/CommonHTML'],
        extensions: [
          'tex2jax.js', 'mml2jax.js', 'asciimath2jax.js', 'AssistiveMML.js'
        ],
        TeX: {
          extensions: ['AMSmath.js', 'AMSsymbols.js', 'noErrors.js', 'noUndefined.js']
        },
        tex2jax: {
          processEscapes: true,
          processEnvironments: true,
          inlineMath: [['$', '$'], ['\\(', '\\)']],
          displayMath: [['$$', '$$'], ['\\[', '\\]']],
        }
      }
    });
  }

  public getAll(req: Request, res: Response, next: NextFunction): void {
    res.send({
      paths: [
        {name: '/mathjax', description: 'Returns the rendered output of a given mathjax string'},
        {name: '/mathjax/example/first', description: 'Returns the rendered output of an example mathjax MathMl string as svg'},
        {name: '/mathjax/example/second', description: 'Returns the rendered output of an example mathjax TeX string as svg'},
        {name: '/mathjax/example/third', description: 'Returns the rendered output of an example mathjax TeX string as svg'},
        {name: '/cache/quiz/assets', description: 'Parses the quiz content and caches all external resources'},
        {name: '/authorize', description: 'Handles authentication via CAS'}
      ]
    });
  }

  public getFavicon(req: Request, res: Response, next: NextFunction): void {
    const theme = req.params.theme || 'theme-Material';
    const filePath = path.join(__dirname, '..', '..', 'images', 'favicons', `favicon-${theme}.png`);
    fs.exists(filePath, (exists: boolean) => {
      if (exists) {
        fs.readFile(filePath, (err, data: Buffer) => {
          res.contentType(fileType(data).mime);
          res.end(data);
        });
      } else {
        res.sendStatus(404);
        res.end();
      }
    });
  }

  public getFirstMathjaxExample(req: Request, res: Response, next: NextFunction): void {
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
    }, function (data) {
      if (!data.errors) {
        res.send(data);
      }
    });
  }

  public getSecondMathjaxExample(req: Request, res: Response, next: NextFunction): void {
    mjAPI.typeset({
      math: `\\begin{align} a_1& =b_1+c_1\\\\ a_2& =b_2+c_2-d_2+e_2 \\end{align}`,
      format: 'TeX', // 'inline-TeX', 'MathML'
      mml: true, //  svg:true, mml: true
    }, function (data) {
      if (!data.errors) {
        res.send(data);
      }
    });
  }

  public getThirdMathjaxExample(req: Request, res: Response, next: NextFunction): void {
    fs.readFile(path.join(__dirname, '..', '..', 'images', 'mathjax', 'example_3.svg'), (err, data: Buffer) => {
      res.send(JSON.stringify(data.toString('utf8')));
    });
  }

  public renderMathjax(req: Request, res: Response, next: NextFunction): void {
    if (!req.body.mathjax || !req.body.format || !req.body.output) {
      res.writeHead(500);
      res.end(`Malformed request received -> ${req.body}`);
      return;
    }
    const mathjaxArray = [].concat(JSON.parse(req.body.mathjax));
    const result = [];
    if (mathjaxArray) {
      mathjaxArray.forEach((mathjaxPlain, index) => {
        const dbResult = MathjaxDAO.getAllPreviouslyRenderedData(mathjaxPlain);
        if (dbResult) {
          result.push(dbResult);
          return;
        }
        mjAPI.typeset({
          math: mathjaxPlain.replace(/ ?\${1,2} ?/g, ''),
          format: req.body.format,
          html: req.body.output === 'html',
          css: req.body.output === 'html',
          svg: req.body.output === 'svg',
          mml: req.body.output === 'mml'
        }).then(data => {
          result.push(data);
          MathjaxDAO.updateRenderedData(data, mathjaxPlain);
          if (index === mathjaxArray.length - 1) {
            res.send(JSON.stringify(result));
          }
        });
      });
    }
  }

  public cacheQuizAssets(req: Request, res: Response, next: NextFunction): void {
    if (!req.body.quiz) {
      res.writeHead(500);
      res.end(`Malformed request received -> ${req.body}`);
      return;
    }
    const quiz: IQuestionGroup = req.body.quiz;
    quiz.questionList.forEach((question: IQuestion) => {
      MatchTextToAssetsDb(question.questionText);
      question.answerOptionList.forEach((answerOption: IAnswerOption) => {
        MatchTextToAssetsDb(answerOption.answerText);
      });
    });
    res.json({
      status: 'STATUS:SUCCESSFUL',
      step: 'CACHE:QUIZ_ASSETS',
      payload: {}
    });
  }

  public getCache(req: Request, res: Response, next: NextFunction): void {
    if (!req.params.digest || !fs.existsSync(path.join(__dirname, '..', '..', 'cache', req.params.digest))) {
      res.writeHead(500);
      res.end(`Malformed request received -> ${req.body}, ${req.params}`);
      return;
    }
    fs.readFile(path.join(__dirname, '..', '..', 'cache', req.params.digest), (err, data: Buffer) => {
      const fileTypeOfBuffer = fileType(data);
      if (fileTypeOfBuffer) {
        res.contentType(fileTypeOfBuffer.mime);
      } else {
        res.contentType('text/html');
      }
      res.end(data.toString('UTF-8'));
    });
  }

  private randomValueHex (len: number = 40) {
    return crypto.randomBytes(Math.ceil((len) / 2))
                 .toString('hex') // convert to hexadecimal format
                 .slice(0, len);   // return required number of characters
  }

  public authorize(req: Request, res: Response, next: NextFunction): void {
    const ticket = req.params.ticket;
    let serviceUrl = req.headers.referer;
    if (serviceUrl instanceof Array) {
      serviceUrl = serviceUrl[0];
    }
    serviceUrl = encodeURIComponent(serviceUrl.replace(`?ticket=${ticket}`, ''));

    if (ticket) {

      const casRequest = https.get(`${casSettings.base_url}/serviceValidate?ticket=${ticket}&service=${serviceUrl}`, (casResponse) => {

        let data = '';

        casResponse.on('data', (chunk) => {
          data += chunk;
        });

        casResponse.on('end', () => {
          xml2js.parseString(data, (err, result) => {
            console.log('received response from cas server', err, result);
            if (err || result['cas:serviceResponse']['cas:authenticationFailure']) {
              res.send({
                status: 'STATUS:FAILED',
                step: 'AUTHENTICATE',
                payload: {err, result}
              });
              return;
            } else {
              const resultData = result['cas:serviceResponse']['cas:authenticationSuccess'][0]['cas:attributes'][0];
              const casDataElement: ICasData = {
                username: resultData['cas:username'],
                displayName: resultData['cas:displayNmae'],
                mail: resultData['cas:mail'],
              };
              CasDAO.add(ticket, casDataElement);
              res.send({
                status: 'STATUS:SUCCESSFUL',
                step: 'AUTHENTICATE',
                payload: {ticket}
              });
            }
          });
        });
      });

      casRequest.on('error', (error) => {
        console.log('error at requesting cas url', error);
        casRequest.abort();
        res.send({
          status: 'STATUS:FAILED',
          step: 'AUTHENTICATE',
          payload: {error}
        });
        return;
      });

    } else {

      const loginUrl = `${casSettings.base_url}/login?service=${serviceUrl}`;
      res.redirect(loginUrl);

    }
  }

  /**
   * Take each handler, and attach to one of the Express.Router's
   * endpoints.
   */
  private init(): void {
    this._router.get('/', this.getAll);

    this._router.get('/favicon/:theme?', this.getFavicon);

    this._router.post('/mathjax', this.renderMathjax.bind(this));
    this._router.get('/mathjax/example/first', this.getFirstMathjaxExample);
    this._router.get('/mathjax/example/second', this.getSecondMathjaxExample);
    this._router.get('/mathjax/example/third', this.getThirdMathjaxExample);

    this._router.post('/cache/quiz/assets', this.cacheQuizAssets.bind(this));
    this._router.get('/cache/quiz/assets/:digest', this.getCache.bind(this));

    this._router.get('/authorize/:ticket?', this.authorize.bind(this));
  }

}

// Create the LibRouter, and export its configured Express.Router
const libRoutes: LibRouter = new LibRouter();

export default libRoutes.router;
