import { arrayProp, getModelForClass, index, pre, prop } from '@typegoose/typegoose';
import DbDAO from '../../db/DbDAO';
import { DbCollection } from '../../enums/DbOperation';
import { IMemberSerialized } from '../../interfaces/entities/Member/IMemberSerialized';
import { IQuizResponse } from '../../interfaces/quizzes/IQuizResponse';
import { ICasData } from '../../interfaces/users/ICasData';
import LoggerService from '../../services/LoggerService';

@index({
  name: 1,
  currentQuizName: 1,
}, {
  unique: true,
  collation: {
    locale: 'en',
    strength: 1,
  },
}) //
@pre<MemberModelItem>(/.*/, function (): void {
  if (!this.colorCode && this.name) {
    this.colorCode = generateRandomColorCode(this.name);
  }
})
export class MemberModelItem implements IMemberSerialized {
  @prop() public colorCode: string;
  @prop({ required: false }) public groupName: string;
  @prop() public name: string;
  @arrayProp({ items: Object }) public responses: Array<IQuizResponse>;
  @prop({ required: false }) public ticket: string;
  @prop() public token: string;
  @prop() public currentQuizName: string;
  @prop() public casProfile: ICasData;
}

function hashCode(str: string): number { // java String#hashCode
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

function intToRGB(i: number): string {
  const c: string = (i & 0x00FFFFFF)
  .toString(16)
  .toUpperCase();

  return '00000'.substring(0, 6 - c.length) + c;
}

function generateRandomColorCode(name: string): string {
  return intToRGB(hashCode(name));
}

export const MemberModel = getModelForClass(MemberModelItem, {
  schemaOptions: {
    collection: DbCollection.Members,
    timestamps: true,
  },
  existingConnection: DbDAO.dbCon,
});

MemberModel.collection.dropIndexes().then(() => MemberModel.createIndexes(err => {
  if (!err) {
    return;
  }

  LoggerService.error('Unique index for MemberModel created with error', err);
}));
