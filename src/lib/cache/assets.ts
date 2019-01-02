import { Binary } from 'bson';
import * as Hex from 'crypto-js/enc-hex';
import * as request from 'request';
import AssetDAO from '../../db/AssetDAO';
import { IAnswerEntity } from '../../interfaces/answeroptions/IAnswerEntity';
import { IQuestion } from '../../interfaces/questions/IQuestion';

import { AssetModel } from '../../models/AssetModel';
import LoggerService from '../../services/LoggerService';
import { staticStatistics } from '../../statistics';

const sha256 = require('crypto-js/sha256');

export const assetsUrlRegex = /[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi;

export function MatchTextToAssetsDb(value: string): Promise<string> {
  const acceptedFileTypes = [/image\/*/];
  const foundUrls = value.match(assetsUrlRegex);
  const assetsBasePath = `${staticStatistics.rewriteAssetCacheUrl}/lib/cache/quiz/assets`;

  return new Promise<string>(resolve => {
    if (!foundUrls) {
      resolve(value);
    }

    foundUrls.forEach((foundUrl: string) => {
      const digest = Hex.stringify(sha256(foundUrl));
      const parsedResult = value.replace(foundUrl, `${assetsBasePath}/${digest}`);
      const exists = AssetDAO.getAssetByDigest(digest);
      if (exists) {
        resolve(parsedResult);
        return;
      }

      if (!foundUrl.startsWith('http')) {
        foundUrl = `http://${foundUrl}`;
      }
      const req = request(foundUrl);
      req.on('error', (err) => {
        LoggerService.error('error at requesting asset url', err.message);
        req.abort();
        resolve(value);
      }).on('response', async (response) => {
        const contentType = response.headers['content-type'];
        const hasContentTypeMatched = acceptedFileTypes.some((contentTypeRegex) => contentType.match(contentTypeRegex) !== null);
        if (!hasContentTypeMatched) {
          req.abort();
          resolve(value);
          return;
        }

        const assetValidator = new AssetModel({
          url: foundUrl.replace(/\./g, '_'),
          digest,
          data: new Binary(response.body),
        });

        const result = assetValidator.validateSync();
        if (result) {
          throw result;
        }

        assetValidator.save();
        resolve(parsedResult);
      });
    });
  });
}

export function parseCachedAssetQuiz(cacheAwareQuestions: Array<IQuestion>): void {
  const assetsBasePath = `${staticStatistics.rewriteAssetCacheUrl}/lib/cache/quiz/assets`;
  cacheAwareQuestions.forEach((question: IQuestion) => {
    const matchedQuestionText = question.questionText.match(assetsUrlRegex);
    if (matchedQuestionText) {
      matchedQuestionText.forEach((matchedValueElement: string) => {
        const encodedText = matchedValueElement.replace(/\./g, '_');
        const existing = AssetDAO.getAssetByUrl(encodedText);
        if (!existing) {
          return;
        }
        const cachedUrl = `${assetsBasePath}/${existing.digest}`;
        question.questionText = question.questionText.replace(matchedValueElement, cachedUrl);
      });
    }
    question.answerOptionList.forEach((answerOption: IAnswerEntity) => {
      const matchedAnswerText = answerOption.answerText.match(assetsUrlRegex);
      if (matchedAnswerText) {
        matchedAnswerText.forEach((matchedValueElement: string) => {
          const encodedText = matchedValueElement.replace(/\./g, '_');
          const existing = AssetDAO.getAssetByUrl(encodedText);
          if (!existing) {
            return;
          }
          const cachedUrl = `${assetsBasePath}/${existing.digest}`;
          answerOption.answerText = answerOption.answerText.replace(matchedValueElement, cachedUrl);
        });
      }
    });
  });
}
