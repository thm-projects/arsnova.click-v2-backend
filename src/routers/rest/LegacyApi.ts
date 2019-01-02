import * as crypto from 'crypto';
import { BodyParam, Controller, Get, InternalServerError, Post } from 'routing-controllers';
import { default as DbDAO } from '../../db/DbDAO';
import QuizDAO from '../../db/quiz/QuizDAO';
import { DbCollection } from '../../enums/DbOperation';
import { IQuizSerialized } from '../../interfaces/quizzes/IQuizEntity';

@Controller('/api')
export class LegacyApiRouter {

  @Get('/')
  private getAll(): object {
    return {};
  }

  @Post('/keepalive')
  private setKeepalive(): string {
    return 'Ok';
  }

  @Post('/addHashtag')
  private addHashtag(@BodyParam('sessionConfiguration') sessionConfiguration: any): string {
    if (QuizDAO.getQuizByName(sessionConfiguration.hashtag)) {
      throw new InternalServerError('Hashtag already in use');
    }

    QuizDAO.addQuiz(sessionConfiguration.hashtag);
    DbDAO.create(DbCollection.Quizzes, {
      quizName: sessionConfiguration.hashtag,
      privateKey: sessionConfiguration.privateKey,
    });

    return 'Hashtag successfully created';
  }

  private dec2hex(dec): string {
    return ('0' + dec.toString(16)).substr(-2);
  }

  @Get('/createPrivateKey')
  private createPrivateKey(): string {
    return crypto.randomBytes(Math.ceil((40) / 2))
    .toString('hex')
    .slice(0, 40);
  }

  @Post('/removeLocalData')
  private removeLocalData(@BodyParam('sessionConfiguration') sessionConfiguration: any): string {
    if (!QuizDAO.isActiveQuiz(sessionConfiguration.hashtag)) {
      throw new InternalServerError('Missing permissions.');
    }
    QuizDAO.setQuizAsInactive(sessionConfiguration.hashtag);
    return 'Session successfully removed';
  }

  @Post('/showReadingConfirmation')
  private showReadingConfirmation(@BodyParam('sessionConfiguration') sessionConfiguration: any): void {
    const activeQuiz = QuizDAO.getActiveQuizByName(sessionConfiguration.hashtag);
    if (!activeQuiz) {
      throw new InternalServerError('Hashtag not found');
    }
    activeQuiz.requestReadingConfirmation();
  }

  @Post('/openSession')
  private openSession(@BodyParam('sessionConfiguration') sessionConfiguration: any): string {
    return undefined;
    // TODO: Figure out how to combine req with /updateQuestionGroup request.
  }

  @Post('/startNextQuestion')
  private startNextQuestion(@BodyParam('sessionConfiguration') sessionConfiguration: any): string {
    const activeQuiz = QuizDAO.getActiveQuizByName(sessionConfiguration.hashtag);
    if (!activeQuiz) {
      throw new InternalServerError('Hashtag not found');
    }
    activeQuiz.nextQuestion();
    return `Next Question with index ${sessionConfiguration.questionIndex} started.`;
  }

  @Post('/updateQuestionGroup')
  private updateQuestionGroup(@BodyParam('questionGroupModel') questionGroup: IQuizSerialized): string {
    if (QuizDAO.getActiveQuizzes().find(val => val.name === questionGroup.name)) {
      throw new InternalServerError('Hashtag not found');
    }
    // TODO Update model of quiz
    return `Session with hashtag ${questionGroup.name} successfully updated`;
  }
}
