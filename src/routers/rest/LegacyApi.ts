import { IQuestionGroup } from 'arsnova-click-v2-types/dist/questions/interfaces';
import * as crypto from 'crypto';
import { BodyParam, Controller, Get, InternalServerError, Post } from 'routing-controllers';
import { default as DbDAO } from '../../db/DbDAO';
import QuizManagerDAO from '../../db/QuizManagerDAO';
import { DATABASE_TYPE } from '../../Enums';

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
    if (QuizManagerDAO.getPersistedQuizByName(sessionConfiguration.hashtag)) {
      throw new InternalServerError('Hashtag already in use');
    }

    QuizManagerDAO.initInactiveQuiz(sessionConfiguration.hashtag);
    DbDAO.create(DATABASE_TYPE.QUIZ, {
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
    if (!QuizManagerDAO.isActiveQuiz(sessionConfiguration.hashtag)) {
      throw new InternalServerError('Missing permissions.');
    }
    QuizManagerDAO.setQuizAsInactive(sessionConfiguration.hashtag);
    return 'Session successfully removed';
  }

  @Post('/showReadingConfirmation')
  private showReadingConfirmation(@BodyParam('sessionConfiguration') sessionConfiguration: any): void {
    const activeQuiz = QuizManagerDAO.getActiveQuizByName(sessionConfiguration.hashtag);
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
    const activeQuiz = QuizManagerDAO.getActiveQuizByName(sessionConfiguration.hashtag);
    if (!activeQuiz) {
      throw new InternalServerError('Hashtag not found');
    }
    activeQuiz.nextQuestion();
    return `Next Question with index ${sessionConfiguration.questionIndex} started.`;
  }

  @Post('/updateQuestionGroup')
  private updateQuestionGroup(@BodyParam('questionGroupModel') questionGroup: IQuestionGroup): string {
    if (!QuizManagerDAO.isInactiveQuiz(questionGroup.hashtag)) {
      throw new InternalServerError('Hashtag not found');
    }
    QuizManagerDAO.initActiveQuiz(questionGroup);
    return `Session with hashtag ${questionGroup.hashtag} successfully updated`;
  }
}
