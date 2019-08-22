import { arrayProp, index, prop, Typegoose } from 'typegoose';
import DbDAO from '../../db/DbDAO';
import MemberDAO from '../../db/MemberDAO';
import { DbCollection, DbEvent, DbWatchStreamOperation } from '../../enums/DbOperation';
import { IMemberSerialized } from '../../interfaces/entities/Member/IMemberSerialized';
import { IQuizResponse } from '../../interfaces/quizzes/IQuizResponse';
import LoggerService from '../../services/LoggerService';

@index({
  name: 1,
  currentQuizName: 1,
}, { unique: true })
export class MemberModelItem extends Typegoose implements IMemberSerialized {
  @prop() public colorCode: string;
  @prop({ required: false }) public groupName: string;
  @prop() public name: string;
  @arrayProp({ items: Object }) public responses: Array<IQuizResponse>;
  @prop({ required: false }) public ticket: string;
  @prop() public token: string;
  @prop() public currentQuizName: string;
}

export const MemberModel = new MemberModelItem().getModelForClass(MemberModelItem, {
  schemaOptions: {
    collection: DbCollection.Members,
    timestamps: true,
  },
  existingConnection: DbDAO.dbCon,
});

MemberModel.createIndexes(err => {
  if (!err) {
    return;
  }

  LoggerService.error('Unique index for MemberModel created with error', err);
});

const eventCallback = data => {

  switch (data.operationType) {
    case DbWatchStreamOperation.Insert:
      LoggerService.info(`Inserting new MemberModel: ${JSON.stringify(data.fullDocument.name)}`);
      MemberDAO.addMember(data.fullDocument);
      break;
    case DbWatchStreamOperation.Update:
      LoggerService.info(`Updating existing MemberModel: ${data.documentKey._id}, ${JSON.stringify(data.updateDescription.updatedFields)}`);
      MemberDAO.updateMember(data.documentKey._id, data.updateDescription.updatedFields);
      break;
    case DbWatchStreamOperation.Invalidate:
      LoggerService.info(`Invalidating MemberModel storage`);
      MemberDAO.removeAllMembers();
      attachEventCallback();
      break;
    case DbWatchStreamOperation.Delete:
      LoggerService.info(`Deleting member: ${data.documentKey._id}`);
      MemberDAO.removeMember(data.documentKey._id);
      break;
    default:
      LoggerService.error(`Unknown db operationType '${data.operationType}' in change listener of MemberModel`);
  }
};

function attachEventCallback(): void {
  MemberModel.watch().on(DbEvent.Change, eventCallback);
}

attachEventCallback();
