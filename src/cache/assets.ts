import { IAnswerOption } from 'arsnova-click-v2-types/src/answeroptions/interfaces';
import { IQuestion } from 'arsnova-click-v2-types/src/questions/interfaces';
import * as Hex from 'crypto-js/enc-hex';
import * as fs from 'fs';
import * as request from 'request';
import { default as DbDAO } from '../db/DbDAO';
import { DATABASE_TYPE } from '../Enums';
import { staticStatistics } from '../statistics';

const sha256 = require('crypto-js/sha256');

export const assetsUrlRegex = /[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi;

export function MatchTextToAssetsDb(value: string): void {
  const acceptedFileTypes = [/image\/*/];
  const matchedValue = value.match(assetsUrlRegex);
  if (matchedValue) {
    matchedValue.forEach((matchedValueElement: string) => {
      const digest = Hex.stringify(sha256(matchedValueElement));
      const cachePath = `${staticStatistics.pathToCache}/${digest}`;
      if (fs.existsSync(cachePath)) {
        DbDAO.create(DATABASE_TYPE.ASSETS, {
          url: matchedValueElement,
          digest,
          path: cachePath,
        }, matchedValueElement.replace(/\./g, '_'));
        return;
      }
      if (!matchedValueElement.startsWith('http')) {
        matchedValueElement = `http://${matchedValueElement}`;
      }
      const req = request(matchedValueElement);
      req.on('response', (response) => {
        const contentType = response.headers['content-type'];
        const hasContentTypeMatched = acceptedFileTypes.some((contentTypeRegex) => contentType.match(contentTypeRegex) !== null);
        if (hasContentTypeMatched) {
          DbDAO.create(DATABASE_TYPE.ASSETS, {
            url: matchedValueElement,
            digest,
            path: cachePath,
          }, matchedValueElement.replace(/\./g, '_'));
        } else {
          req.abort();
          fs.exists(cachePath, (exists: boolean) => {
            if (exists) {
              fs.unlink(cachePath, (err) => !err ? null : console.log('error while unlinking file', err));
            }
          });
        }
      }).on('error', (err) => {
        console.log('error at requesting asset url', err);
        req.abort();
      }).pipe(fs.createWriteStream(cachePath));
    });
  }
}

export function parseCachedAssetQuiz(cacheAwareQuestions: Array<IQuestion>): void {
  const assetsCache = DbDAO.read(DATABASE_TYPE.ASSETS);
  const assetsBasePath = `${staticStatistics.rewriteAssetCacheUrl}/lib/cache/quiz/assets`;
  cacheAwareQuestions.forEach((question: IQuestion) => {
    const matchedQuestionText = question.questionText.match(assetsUrlRegex);
    if (matchedQuestionText) {
      matchedQuestionText.forEach((matchedValueElement: string) => {
        const encodedText = matchedValueElement.replace(/\./g, '_');
        if (!assetsCache[encodedText]) {
          return;
        }
        const cachedUrl = `${assetsBasePath}/${assetsCache[encodedText].digest}`;
        question.questionText = question.questionText.replace(matchedValueElement, cachedUrl);
      });
    }
    question.answerOptionList.forEach((answerOption: IAnswerOption) => {
      const matchedAnswerText = answerOption.answerText.match(assetsUrlRegex);
      if (matchedAnswerText) {
        matchedAnswerText.forEach((matchedValueElement: string) => {
          const encodedText = matchedValueElement.replace(/\./g, '_');
          if (!assetsCache[encodedText]) {
            return;
          }
          const cachedUrl = `${assetsBasePath}/${assetsCache[encodedText].digest}`;
          answerOption.answerText = answerOption.answerText.replace(matchedValueElement, cachedUrl);
        });
      }
    });
  });
}
