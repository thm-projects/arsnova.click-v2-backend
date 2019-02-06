import { DeleteWriteOpResultObject } from 'mongodb';
import {
  BadRequestError, BodyParam, Delete, Get, HeaderParam, InternalServerError, JsonController, Param, Post, Put, UnauthorizedError,
} from 'routing-controllers';
import MemberDAO from '../../db/MemberDAO';
import QuizDAO from '../../db/quiz/QuizDAO';
import { MemberEntity } from '../../entities/member/MemberEntity';
import { MessageProtocol, StatusProtocol } from '../../enums/Message';
import { IMemberSerialized } from '../../interfaces/entities/Member/IMemberSerialized';
import { IQuizEntity } from '../../interfaces/quizzes/IQuizEntity';
import { MemberModel } from '../../models/member/MemberModel';
import { AuthService } from '../../services/AuthService';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/member')
export class MemberRouter extends AbstractRouter {

  @Get('/')
  public getMembers(): Array<IMemberSerialized> {
    return MemberDAO.storage.map(member => member.serialize());
  }

  @Post('/token')
  public generateMemberToken(@BodyParam('name') name: string, @BodyParam('quizName') quizName: string): string {
    return AuthService.createToken({
      name,
      quizName,
    });
  }

  @Get('/available/:quizName')
  public getAvailableMemberNames(@Param('quizName') quizName: string): Array<string> {
    const quiz = QuizDAO.getQuizByName(quizName);
    const nicks = JSON.parse(JSON.stringify(quiz.sessionConfig.nicks.selectedNicks));

    MemberDAO.getMembersOfQuiz(quizName).forEach(val => nicks.splice(nicks.indexOf(val.name), 1));

    return nicks;
  }

  @Put('/')
  public async addMember(
    @BodyParam('member') member: IMemberSerialized, //
    @HeaderParam('authorization') token: string, //
  ): Promise<object> {
    const activeQuiz: IQuizEntity = QuizDAO.getActiveQuizByName(member.currentQuizName);

    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.IsInactive,
        payload: {},
      }));
    }

    if (!member.name || (activeQuiz.sessionConfig.nicks.restrictToCasLogin && !member.ticket)) {
      throw new InternalServerError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.InvalidParameters,
        payload: {},
      }));
    }

    try {
      if (!member.groupName) {
        member.groupName = 'Default';
      }

      member.token = token;

      const memberValidator = new MemberModel(new MemberEntity(member).serialize());

      const results = memberValidator.validateSync();

      if (results) {
        throw results;
      }

      await memberValidator.save();

      return {
        status: StatusProtocol.Success,
        step: MessageProtocol.Added,
        payload: {
          memberGroups: activeQuiz.memberGroups.map(memberGroup => {
            return memberGroup.serialize();
          }),
          sessionConfiguration: activeQuiz.sessionConfig.serialize(),
        },
      };

    } catch (ex) {
      throw new InternalServerError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.Added,
        payload: { message: ex.message },
      }));
    }
  }

  @Put('/reading-confirmation')
  public addReadingConfirmation(@HeaderParam('authorization') token: string, //
  ): object {

    const member = MemberDAO.getMemberByToken(token);
    const quiz = QuizDAO.getActiveQuizByName(member.currentQuizName);
    if (!member || !quiz) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    member.setReadingConfirmation();

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.ReadingConfirmationRequested,
      payload: {},
    };
  }

  @Put('/confidence-value')
  public addConfidenceValue(
    @HeaderParam('authorization') token: string, //
    @BodyParam('confidenceValue') confidenceValue: number, //
  ): object {

    const member = MemberDAO.getMemberByToken(token);
    const quiz = QuizDAO.getActiveQuizByName(member.currentQuizName);
    if (!member || !quiz) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    member.setConfidenceValue(confidenceValue);

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.ConfidenceValueRequested,
      payload: {},
    };
  }

  @Put('/response')
  public addResponse(
    @HeaderParam('authorization') token: string, //
    @BodyParam('response') value: string, //
  ): object {

    if (!Array.isArray(value) && !['string', 'number'].includes(typeof value)) {
      throw new BadRequestError(MessageProtocol.InvalidData);
    }

    const member = MemberDAO.getMemberByToken(token);
    const quiz = QuizDAO.getActiveQuizByName(member.currentQuizName);
    if (!member || !quiz) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    if (member.responses[quiz.currentQuestionIndex].responseTime > 0) {
      throw new BadRequestError(MessageProtocol.DuplicateResponse);
    }

    member.addResponseValue(value);

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.UpdatedResponse,
      payload: {},
    };
  }

  @Delete('/:quizName/:nickname')
  public async deleteMember(
    @Param('quizName') quizName: string, //
    @Param('nickname') nickname: string, //
  ): Promise<object> {

    const activeQuiz: IQuizEntity = QuizDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      return;
    }
    const result: DeleteWriteOpResultObject = await activeQuiz.removeMember(nickname);
    const response: Object = { status: result.deletedCount ? StatusProtocol.Success : StatusProtocol.Failed };
    if (result && result.deletedCount) {
      Object.assign(response, {
        step: MessageProtocol.Removed,
        payload: {},
      });
    } else {
      Object.assign(response, {
        message: result,
      });
    }
    return response;
  }

  @Get('/:quizName')
  public getAllMembers(@Param('quizName') quizName: string, //
  ): object {

    const activeQuiz: IQuizEntity = QuizDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.IsInactive,
        payload: {},
      }));
    }

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.GetPlayers,
      payload: {
        memberGroups: activeQuiz.memberGroups.map(memberGroup => memberGroup.serialize()),
      },
    };
  }

  @Get('/:quizName/available')
  public getRemainingNicks(@Param('quizName') quizName: string, //
  ): object {

    const activeQuiz: IQuizEntity = QuizDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      throw new InternalServerError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.IsInactive,
        payload: {},
      }));
    }
    const names: Array<String> = activeQuiz.sessionConfig.nicks.selectedNicks.filter((nick) => {
      return !activeQuiz.memberGroups.find(memberGroup => {
        return !!memberGroup.members.find(value => value.name === nick);
      });
    });
    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.GetRemainingNicks,
      payload: { nicknames: names },
    };
  }
}
