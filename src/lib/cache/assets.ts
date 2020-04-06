import * as Hex from 'crypto-js/enc-hex';
import { Document } from 'mongoose';
import * as requestPromise from 'request-promise-native';
import AssetDAO from '../../db/AssetDAO';
import { IQuestion, IQuestionBase } from '../../interfaces/questions/IQuestion';
import { IQuiz } from '../../interfaces/quizzes/IQuizEntity';

import { AssetModel, AssetModelItem } from '../../models/AssetModel';
import LoggerService from '../../services/LoggerService';
import { staticStatistics } from '../../statistics';
import { asyncForEach } from '../async-for-each';

const sha256 = require('crypto-js/sha256');

export const assetsUrlRegex = /[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi;
const assetsPathUrlRegex = '(' + staticStatistics.rewriteAssetCacheUrl + '([a-z]*[\\/])*([0-9a-z]*))';

export function GetAssetUrlByDigest(digest: string): Promise<Document & AssetModelItem> {
  return AssetModel.findOne({ digest }, {
    _id: 0,
    url: 1,
  }).exec();
}

export async function MatchAssetCachedQuiz(quiz: IQuiz): Promise<IQuiz> {
  quiz.questionList = await Promise.all<IQuestionBase>((
    quiz.questionList as Array<IQuestionBase>
  ).map(async question => {

    question.answerOptionList = await Promise.all(question.answerOptionList.map(async answer => {
      const answerMatched = answer.answerText.matchAll(new RegExp(assetsPathUrlRegex, 'gi'));
      let answerTextMatcher = answerMatched.next();
      while (!answerTextMatcher.done) {
        const answerTextDbResult = await GetAssetUrlByDigest(answerTextMatcher.value[3]);
        if (answerTextDbResult) {
          const url = answerTextDbResult.url;
          answer.answerText = answer.answerText.replace(answerTextMatcher.value[0], url);
        }
        answerTextMatcher = answerMatched.next();
      }

      return answer;
    }));

    const questionTextMatched = question.questionText.matchAll(new RegExp(assetsPathUrlRegex, 'gi'));
    let questionTextMatcher = questionTextMatched.next();
    while (!questionTextMatcher.done) {
      const questionTextDbResult = await GetAssetUrlByDigest(questionTextMatcher.value[3]);
      if (questionTextDbResult) {
        const url = questionTextDbResult.url;
        question.questionText = question.questionText.replace(questionTextMatcher.value[0], url);
      }
      questionTextMatcher = questionTextMatched.next();
    }

    return question;
  })) as Array<IQuestion>;

  return quiz;
}

export function MatchTextToAssetsDb(value: string): Promise<string> {
  const acceptedFileTypes = [/image\/*/];
  const foundUrls = value.match(assetsUrlRegex);
  const assetsBasePath = `${staticStatistics.rewriteAssetCacheUrl}/lib/cache/quiz/assets`;

  return new Promise<string>(resolve => {
    if (!foundUrls) {
      LoggerService.debug('[MatchTextToAssetsDb] Abort: No URLs found');
      resolve(value);
      return;
    }

    return asyncForEach(foundUrls, async (foundUrl: string) => {
      const digest = Hex.stringify(sha256(foundUrl));
      const parsedResult = value.replace(foundUrl, `${assetsBasePath}/${digest}`);
      const exists = await AssetDAO.getAssetByDigest(digest);
      if (exists) {
        LoggerService.debug('[MatchTextToAssetsDb] Found existing digest ' + digest);
        resolve(parsedResult);
        return;
      }

      if (!foundUrl.startsWith('http')) {
        foundUrl = `http://${foundUrl}`;
      }
      requestPromise({
        url: foundUrl,
        method: 'GET',
        resolveWithFullResponse: true,
        encoding: null,
      }).then(response => {
        const contentType = response.headers['content-type'];
        const hasContentTypeMatched = acceptedFileTypes.some((contentTypeRegex) => contentType.match(contentTypeRegex) !== null);
        if (!hasContentTypeMatched) {
          LoggerService.debug('[MatchTextToAssetsDb] Resource "' + digest + '" is not an accepted content type ' + contentType);
          resolve(value);
          return;
        }

        const buffer = Buffer.from(response.body, 'utf8');

        LoggerService.debug('[MatchTextToAssetsDb] Resource "' + digest + '" is added to the db');
        return AssetDAO.addAsset({
          url: foundUrl,
          digest,
          mimeType: contentType,
          data: buffer,
        });

      }).then(() => resolve(parsedResult)).catch((err) => {
        LoggerService.error('error at requesting asset url', err);
        resolve(value);
      });
    });
  });
}
