import { IMemberGroupEntity } from '../../interfaces/users/IMemberGroupEntity';
import { IMemberGroupSerialized } from '../../interfaces/users/IMemberGroupSerialized';
import { AbstractEntity } from '../AbstractEntity';

export class MemberGroupEntity extends AbstractEntity implements IMemberGroupEntity {
  private _members: Array<string>;

  get members(): Array<string> {
    return this._members;
  }

  set members(value: Array<string>) {
    this._members = value;
  }

  get name(): string {
    return this._name;
  }

  private readonly _name: string;

  constructor(data: IMemberGroupSerialized) {
    super();

    this._name = data.name;
    this._members = data.members || [];
  }

  public serialize(): IMemberGroupSerialized {
    return {
      name: this.name,
      members: this.members,
    };
  }
}
