import { getModelForClass, index, modelOptions, pre, prop, Severity } from '@typegoose/typegoose';
import { IsArray, IsBoolean, IsObject, IsString } from 'class-validator';
import DbDAO from '../../db/DbDAO';
import { DbCollection } from '../../enums/DbOperation';
import { IMemberSerialized } from '../../interfaces/entities/Member/IMemberSerialized';
import { IQuizResponse } from '../../interfaces/quizzes/IQuizResponse';
import { ICasData } from '../../interfaces/users/ICasData';

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
}) //
@modelOptions({ options: { allowMixed: Severity.ALLOW } }) //
export class MemberModelItem implements IMemberSerialized {
  @prop() @IsString() public colorCode: string;
  @prop({ required: false }) @IsString() public groupName: string;
  @prop() @IsString() public name: string;
  @prop({ type: Object }) @IsArray() public responses: Array<IQuizResponse>;
  @prop({ required: false }) @IsString() public ticket: string;
  @prop() @IsString() public token: string;
  @prop() @IsString() public currentQuizName: string;
  @prop() @IsObject() public casProfile: ICasData;
  @prop() @IsString() public bonusToken: string;
  @prop() @IsBoolean() public isActive: boolean;
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
  options: {
    runSyncIndexes: true,
    allowMixed: Severity.ALLOW,
  },
});

