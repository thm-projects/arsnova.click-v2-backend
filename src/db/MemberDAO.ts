import { ObjectId } from 'bson';
import { MemberEntity } from '../entities/member/MemberEntity';
import { QuizEntity } from '../entities/quiz/QuizEntity';
import { DbCollection, DbEvent } from '../enums/DbOperation';
import { IMemberEntity } from '../interfaces/entities/Member/IMemberEntity';
import { IMemberSerialized } from '../interfaces/entities/Member/IMemberSerialized';
import { IQuizEntity } from '../interfaces/quizzes/IQuizEntity';
import { AbstractDAO } from './AbstractDAO';
import DbDAO from './DbDAO';
import QuizDAO from './quiz/QuizDAO';

class MemberDAO extends AbstractDAO<Array<MemberEntity>> {

  constructor() {
    super([]);

    DbDAO.isDbAvailable.on(DbEvent.Connected, async (isConnected) => {
      if (isConnected) {
        const cursor = DbDAO.readMany(DbCollection.Members, {});
        cursor.forEach(doc => {
          this.addMember(doc);
        });
      }
    });
  }

  public static getInstance(): MemberDAO {
    if (!this.instance) {
      this.instance = new MemberDAO();
    }

    return this.instance;
  }

  public getMemberByName(name: string): MemberEntity {
    return this.storage.find(val => val.name === name);
  }

  public addMember(memberSerialized: IMemberSerialized): void {
    if (this.getMemberById(memberSerialized.id)) {
      throw new Error(`Duplicate member insertion: (name: ${memberSerialized.name}, id: ${memberSerialized.id})`);
    }

    const member = new MemberEntity(memberSerialized);
    this.storage.push(member);
    this.updateEmitter.emit(DbEvent.Create, member);

    if (QuizDAO.isInitialized) {
      this.notifyQuizDAO(member);
    } else {
      QuizDAO.updateEmitter.once(DbEvent.Initialized, () => this.notifyQuizDAO(member));
    }
  }

  public updateMember(id: ObjectId, updatedFields: { [key: string]: any }): void {
    const member = this.getMemberById(id);
    if (!member) {
      throw new Error(`Unknown updated member: ${id.toHexString()}`);
    }

    Object.keys(updatedFields).forEach(key => member[key] = updatedFields[key]);

    this.updateEmitter.emit(DbEvent.Change, member);
  }

  public removeAllMembers(): void {
    this.storage.forEach(member => {
      this.updateEmitter.emit(DbEvent.Delete, member);
      QuizDAO.getQuizByName(member.currentQuizName).onMemberRemoved(member);
    });
    this.storage.splice(0, this.storage.length);
  }

  public removeMember(id: ObjectId | string): void {
    const members = this.storage.splice(this.storage.findIndex(val => val.id.equals(id)), 1);

    if (members.length) {
      this.updateEmitter.emit(DbEvent.Delete, members[0]);
      QuizDAO.getQuizByName(members[0].currentQuizName).onMemberRemoved(members[0]);
    }
  }

  public getMembersOfQuiz(quizName: string): Array<IMemberEntity> {
    return this.storage.filter(val => !!val.currentQuizName.match(new RegExp(`^${quizName}$`, 'i')));
  }

  public getMemberByToken(token: string): MemberEntity {
    return this.storage.find(val => val.token === token);
  }

  public removeMembersOfQuiz(removedQuiz: QuizEntity | IQuizEntity): void {
    DbDAO.deleteMany(DbCollection.Members, { currentQuizName: removedQuiz.name });
  }

  private notifyQuizDAO(member: MemberEntity): void {
    const quiz = QuizDAO.getQuizByName(member.currentQuizName);
    if (!quiz) {
      console.error(`The quiz '${member.currentQuizName}' for the member ${member.name} could not be found`);
      return;
    }
    QuizDAO.getQuizByName(member.currentQuizName).onMemberAdded(member);
  }

  private getMemberById(id: ObjectId | string): MemberEntity {
    return this.storage.find(val => val.id.equals(id));
  }
}

export default MemberDAO.getInstance();
