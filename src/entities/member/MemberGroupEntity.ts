import MemberDAO from '../../db/MemberDAO';
import { IMemberEntity } from '../../interfaces/entities/Member/IMemberEntity';
import { IMemberGroupEntity } from '../../interfaces/users/IMemberGroupEntity';
import { IMemberGroupSerialized } from '../../interfaces/users/IMemberGroupSerialized';
import { AbstractEntity } from '../AbstractEntity';

export class MemberGroupEntity extends AbstractEntity implements IMemberGroupEntity {
  private _members: Array<IMemberEntity>;

  get members(): Array<IMemberEntity> {
    return this._members;
  }

  set members(value: Array<IMemberEntity>) {
    this._members = value;
  }

  get name(): string {
    return this._name;
  }

  private readonly _name: string;

  constructor(data: IMemberGroupSerialized) {
    super();

    this._name = data.name;
    this._members = (data.members || []).map(val => MemberDAO.getMemberByName(val.name));
  }

  public serialize(): IMemberGroupSerialized {
    return {
      name: this.name,
      members: this.members.map(val => val.serialize()),
    };
  }
}
