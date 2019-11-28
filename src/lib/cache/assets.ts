import * as Hex from 'crypto-js/enc-hex';
import { Document } from 'mongoose';
import * as requestPromise from 'request-promise-native';
import AssetDAO from '../../db/AssetDAO';
import { IQuiz } from '../../interfaces/quizzes/IQuizEntity';

import { AssetModel, AssetModelItem } from '../../models/AssetModel';
import LoggerService from '../../services/LoggerService';
import { staticStatistics } from '../../statistics';
import { asyncForEach } from '../async-for-each';

const sha256 = require('crypto-js/sha256');

export const assetsUrlRegex = /[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi;
const assetsPathUrlRegex = '(' + staticStatistics.rewriteAssetCacheUrl + '[\/a-z]*([0-9a-z]*))';

export function GetAssetUrlByDigest(digest: string): Promise<Document & AssetModelItem> {
  return AssetModel.findOne({ digest }, {
    _id: 0,
    url: 1,
  }).exec();
}

export async function MatchAssetCachedQuiz(quiz: IQuiz): Promise<IQuiz> {
  quiz.questionList = await Promise.all(quiz.questionList.map(async question => {

    question.answerOptionList = await Promise.all(question.answerOptionList.map(async answer => {
      const answerMatched = answer.answerText.matchAll(new RegExp(assetsPathUrlRegex, 'gi'));
      let answerTextMatcher = answerMatched.next();
      while (!answerTextMatcher.done) {
        const answerTextDbResult = (await GetAssetUrlByDigest(answerTextMatcher.value[2]));
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
      const quesitonTextDbResult = (await GetAssetUrlByDigest(questionTextMatcher.value[2]));
      if (quesitonTextDbResult) {
        const url = quesitonTextDbResult.url;
        question.questionText = question.questionText.replace(questionTextMatcher.value[0], url);
      }
      questionTextMatcher = questionTextMatched.next();
    }

    return question;
  }));

  return quiz;
}

export function MatchTextToAssetsDb(value: string): Promise<string> {
  const acceptedFileTypes = [/image\/*/];
  const foundUrls = value.match(assetsUrlRegex);
  const assetsBasePath = `${staticStatistics.rewriteAssetCacheUrl}/lib/cache/quiz/assets`;

  return new Promise<string>(resolve => {
    if (!foundUrls) {
      resolve(value);
      return;
    }

    return asyncForEach(foundUrls, async (foundUrl: string) => {
      const digest = Hex.stringify(sha256(foundUrl));
      const parsedResult = value.replace(foundUrl, `${assetsBasePath}/${digest}`);
      const exists = await AssetDAO.getAssetByDigest(digest);
      if (exists) {
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
          resolve(value);
          return;
        }

        const buffer = Buffer.from(response.body, 'utf8');

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
