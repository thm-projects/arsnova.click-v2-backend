import { IActiveQuiz } from 'arsnova-click-v2-types/dist/common';
import { COMMUNICATION_PROTOCOL } from 'arsnova-click-v2-types/dist/communication_protocol';
import { BodyParam, Delete, Get, InternalServerError, JsonController, Param, Put } from 'routing-controllers';
import QuizManagerDAO from '../../db/QuizManagerDAO';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/member')
export class MemberRouter extends AbstractRouter {

  @Put('/')
  public addMember(
    @BodyParam('quizName') quizName: string, //
    @BodyParam('ticket') ticket: string, //
    @BodyParam('groupName') groupName: string, //
    @BodyParam('nickname') nickname: string, //
  ): object {
    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(quizName);

    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
    }

    if (!nickname || (activeQuiz.originalObject.sessionConfig.nicks.restrictToCasLogin && !ticket)) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.INVALID_PARAMETERS,
        payload: {},
      }));
    }

    try {
      const webSocketAuthorization: number = Math.random();
      if (!groupName) {
        groupName = 'Default';
      }

      const members = activeQuiz.memberGroups.find((value => value.name === groupName)).members;

      activeQuiz.addMember(nickname, webSocketAuthorization, groupName, ticket);

      return {
        status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
        step: COMMUNICATION_PROTOCOL.MEMBER.ADDED,
        payload: {
          member: members[members.length - 1].serialize(),
          memberGroups: activeQuiz.memberGroups.map(memberGroup => {
            return memberGroup.serialize();
          }),
          sessionConfiguration: activeQuiz.originalObject.sessionConfig,
          webSocketAuthorization: webSocketAuthorization,
        },
      };

    } catch (ex) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.MEMBER.ADDED,
        payload: { message: ex.message },
      }));
    }
  }

  @Put('/reading-confirmation')
  public addReadingConfirmation(
    @BodyParam('quizName') quizName: string, //
    @BodyParam('nickname') nickname: string, //
  ): object {

    const activeQuiz = QuizManagerDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
    }
    activeQuiz.setReadingConfirmation(nickname);
    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.READING_CONFIRMATION_REQUESTED,
      payload: {},
    };
  }

  @Put('/confidence-value')
  public addConfidenceValue(
    @BodyParam('quizName') quizName: string, //
    @BodyParam('nickname') nickname: string, //
    @BodyParam('confidenceValue') confidenceValue: number, //
  ): object {

    const activeQuiz = QuizManagerDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
    }
    activeQuiz.setConfidenceValue(nickname, confidenceValue);
    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.CONFIDENCE_VALUE_REQUESTED,
      payload: {},
    };
  }

  @Delete('/:quizName/:nickname')
  public deleteMember(
    @Param('quizName') quizName: string, //
    @Param('nickname') nickname: string, //
  ): object {

    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
    }
    const result: boolean = activeQuiz.removeMember(nickname);
    const response: Object = { status: result ? COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL : COMMUNICATION_PROTOCOL.STATUS.FAILED };
    if (result) {
      Object.assign(response, {
        step: COMMUNICATION_PROTOCOL.MEMBER.REMOVED,
        payload: {},
      });
    }
    return response;
  }

  @Get('/:quizName')
  public getAllMembers(
    @Param('quizName') quizName: string, //
    @Param('nickname') nickname: string, //
  ): object {

    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
    }

    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.LOBBY.GET_PLAYERS,
      payload: {
        memberGroups: activeQuiz.memberGroups.map(memberGroup => memberGroup.serialize()),
      },
    };
  }

  @Get('/quizName/available')
  public getRemainingNicks(
    @Param('quizName') quizName: string, //
    @Param('nickname') nickname: string, //
  ): object {

    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
    }
    const names: Array<String> = activeQuiz.originalObject.sessionConfig.nicks.selectedNicks.filter((nick) => {
      return !activeQuiz.memberGroups.find(memberGroup => {
        return !!memberGroup.members.find(value => value.name === nick);
      });
    });
    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.QUIZ.GET_REMAINING_NICKS,
      payload: { nicknames: names },
    };
  }

  @Put('/response')
  public addResponse(
    @Param('quizName') quizName: string, //
    @Param('nickname') nickname: string, //
    @BodyParam('nickname') value: Array<number>, //
  ): object {

    if (!quizName || !nickname || !value) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.INVALID_PARAMETERS,
        payload: {},
      }));
    }

    const activeQuiz: IActiveQuiz = QuizManagerDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.QUIZ.IS_INACTIVE,
        payload: {},
      }));
    }

    if (activeQuiz.findMemberByName(nickname).responses[activeQuiz.currentQuestionIndex].responseTime) {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.MEMBER.DUPLICATE_RESPONSE,
        payload: {},
      }));
    }

    if (typeof value === 'undefined') {
      throw new InternalServerError(JSON.stringify({
        status: COMMUNICATION_PROTOCOL.STATUS.FAILED,
        step: COMMUNICATION_PROTOCOL.MEMBER.INVALID_RESPONSE,
        payload: {},
      }));
    }

    activeQuiz.addResponseValue(nickname, value);

    return {
      status: COMMUNICATION_PROTOCOL.STATUS.SUCCESSFUL,
      step: COMMUNICATION_PROTOCOL.MEMBER.UPDATED_RESPONSE,
      payload: {},
    };
  }

  @Get('/')
  private getAll(): object {
    return {};
  }
}
