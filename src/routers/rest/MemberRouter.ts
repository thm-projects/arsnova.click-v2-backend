import {
  BadRequestError,
  Body,
  BodyParam,
  Delete,
  Get,
  HeaderParam,
  JsonController,
  Param,
  Post,
  Put,
  UnauthorizedError, UseBefore,
} from 'routing-controllers';
import MemberDAO from '../../db/MemberDAO';
import QuizDAO from '../../db/QuizDAO';
import { MessageProtocol, StatusProtocol } from '../../enums/Message';
import { IMessage } from '../../interfaces/communication/IMessage';
import { IMemberSerialized } from '../../interfaces/entities/Member/IMemberSerialized';
import illegalNicks from '../../lib/nicknames/illegalNicks';
import { AuthService } from '../../services/AuthService';
import LoggerService from '../../services/LoggerService';
import { AbstractRouter } from './AbstractRouter';

@JsonController('/api/v1/member')
export class MemberRouter extends AbstractRouter {

  @Post('/token')
  public generateMemberToken(@BodyParam('name') name: string, @BodyParam('quizName') quizName: string): string {
    return AuthService.createToken({
      name,
      quizName,
    });
  }

  @Get('/token/bonus')
  @UseBefore(req => (AuthService.decodeLoginToken(req.headers.authorization) as any).privateKey)
  public async getCurrentBonusToken(@HeaderParam('authorization') token: string): Promise<string> {
    const member = await MemberDAO.getMemberByToken(token);
    if (!member) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }
    return member.bonusToken;
  }

  @Get('/available/:quizName')
  public async getAvailableMemberNames(@Param('quizName') quizName: string): Promise<Array<string>> {
    const quiz = await QuizDAO.getQuizByName(quizName);
    const nicks = JSON.parse(JSON.stringify(quiz.sessionConfig.nicks.selectedNicks));

    (
      await MemberDAO.getMembersOfQuiz(quizName)
    ).forEach(val => nicks.splice(nicks.indexOf(val.name), 1));

    return nicks;
  }

  @Put('/')
  @UseBefore(req => (AuthService.decodeLoginToken(req.headers.authorization) as any).privateKey)
  public async addMember(
    @BodyParam('member') member: IMemberSerialized, //
    @HeaderParam('authorization') token: string, //
  ): Promise<object> {
    const activeQuiz = await QuizDAO.getActiveQuizByName(member.currentQuizName);

    if (!activeQuiz) {
      return {
        status: StatusProtocol.Failed,
        step: MessageProtocol.IsInactive,
        payload: {},
      };
    }

    if (!member.name) {
      throw new BadRequestError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.InvalidParameters,
        payload: {},
      }));
    }

    if (illegalNicks.includes(member.name.toUpperCase())) {
      return {
        status: StatusProtocol.Failed,
        step: MessageProtocol.IllegalName,
      };
    }

    if (await MemberDAO.isMemberInQuiz(member, activeQuiz)) {
      return {
        status: StatusProtocol.Failed,
        step: MessageProtocol.DuplicateLogin,
      };
    }

    try {
      member.token = token;
      member.responses = MemberDAO.generateResponseForQuiz(activeQuiz.questionList.length);

      await MemberDAO.addMember(member);

      return {
        status: StatusProtocol.Success,
        step: MessageProtocol.Added,
      };

    } catch (ex) {
      LoggerService.error('Cannot add member', ex.message);
      throw new BadRequestError(JSON.stringify({
        status: StatusProtocol.Failed,
        step: MessageProtocol.Added,
        payload: { message: ex.message },
      }));
    }
  }

  @Put('/reading-confirmation')
  @UseBefore(req => (AuthService.decodeLoginToken(req.headers.authorization) as any).privateKey)
  public async addReadingConfirmation(@HeaderParam('authorization') token: string, //
  ): Promise<IMessage> {

    const member = await MemberDAO.getMemberByToken(token);
    if (!member) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    const quiz = await QuizDAO.getActiveQuizByName(member.currentQuizName);
    if (!quiz) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    await MemberDAO.setReadingConfirmation(member);

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.ReadingConfirmationRequested,
      payload: {},
    };
  }

  @Put('/confidence-value')
  @UseBefore(req => (AuthService.decodeLoginToken(req.headers.authorization) as any).privateKey)
  public async addConfidenceValue(
    @HeaderParam('authorization') token: string, //
    @BodyParam('confidenceValue') confidenceValue: number, //
  ): Promise<IMessage> {

    const member = await MemberDAO.getMemberByToken(token);
    if (!member) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    const quiz = await QuizDAO.getActiveQuizByName(member.currentQuizName);
    if (!quiz) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    await MemberDAO.setConfidenceValue(member, confidenceValue);

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.ConfidenceValueRequested,
      payload: {},
    };
  }

  @Put('/response')
  @UseBefore(req => (AuthService.decodeLoginToken(req.headers.authorization) as any).privateKey)
  public async addResponse(
    @HeaderParam('authorization') token: string, //
    @Body() body: any, // Must use body since string value '3,14' of body.response results in a JSON.parse error if using BodyParam
  ): Promise<IMessage> {

    if (!Array.isArray(body.response) && !['string', 'number'].includes(typeof body.response)) {
      throw new BadRequestError(MessageProtocol.InvalidData);
    }

    const member = await MemberDAO.getMemberByToken(token);
    if (!member) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    const quiz = await QuizDAO.getActiveQuizByName(member.currentQuizName);
    if (!quiz) {
      throw new UnauthorizedError(MessageProtocol.InsufficientPermissions);
    }

    if (!member.responses[quiz.currentQuestionIndex]) {
      console.error(`No responses for questionIndex ${quiz.currentQuestionIndex} found for member ${member.name} of quiz ${quiz.name}.
        Quiz has ${quiz.questionList.length} questions.`);
      throw new BadRequestError(MessageProtocol.InvalidData);
    }

    if (member.responses[quiz.currentQuestionIndex].responseTime > 0) {
      throw new BadRequestError(MessageProtocol.DuplicateResponse);
    }

    if (typeof body.response === 'number') {
      body.response = String(body.response);
    }
    await MemberDAO.addResponseValue(member, body.response);

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
  ): Promise<IMessage> {

    await MemberDAO.removeMemberByName(quizName, nickname);

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.Removed,
      payload: {},
    };
  }

  @Get('/:quizName')
  public async getAllMembers(@Param('quizName') quizName: string, //
  ): Promise<IMessage> {
    const activeQuiz = await QuizDAO.getActiveQuizByName(quizName);
    if (!activeQuiz) {
      return {
        status: StatusProtocol.Success,
        step: MessageProtocol.GetPlayers,
        payload: {
          members: [],
        },
      };
    }

    const members = (
      await MemberDAO.getMembersOfQuiz(quizName)
    ).map(member => member.toJSON());

    return {
      status: StatusProtocol.Success,
      step: MessageProtocol.GetPlayers,
      payload: {
        members,
      },
    };
  }
}
