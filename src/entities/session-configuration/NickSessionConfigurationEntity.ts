import { INickSessionConfigurationEntity } from '../../interfaces/session_configuration/nicks/INickSessionConfigurationEntity';
import { INickSessionConfigurationSerialized } from '../../interfaces/session_configuration/nicks/INickSessionConfigurationSerialized';

export class NickSessionConfigurationEntity implements INickSessionConfigurationEntity {
  private _memberGroups: Array<string>;

  get memberGroups(): Array<string> {
    return this._memberGroups;
  }

  set memberGroups(value: Array<string>) {
    this._memberGroups = value;
  }

  private _maxMembersPerGroup: number;

  get maxMembersPerGroup(): number {
    return this._maxMembersPerGroup;
  }

  set maxMembersPerGroup(value: number) {
    this._maxMembersPerGroup = value;
  }

  private _autoJoinToGroup: boolean;

  get autoJoinToGroup(): boolean {
    return this._autoJoinToGroup;
  }

  set autoJoinToGroup(value: boolean) {
    this._autoJoinToGroup = value;
  }

  private _selectedNicks: Array<string>;

  get selectedNicks(): Array<string> {
    return this._selectedNicks;
  }

  set selectedNicks(value: Array<string>) {
    this._selectedNicks = value;
  }

  private _blockIllegalNicks: boolean;

  get blockIllegalNicks(): boolean {
    return this._blockIllegalNicks;
  }

  set blockIllegalNicks(value: boolean) {
    this._blockIllegalNicks = value;
  }

  private _restrictToCasLogin: boolean;

  get restrictToCasLogin(): boolean {
    return this._restrictToCasLogin;
  }

  set restrictToCasLogin(value: boolean) {
    this._restrictToCasLogin = value;
  }

  constructor({
                memberGroups = Array<string>(), //
                selectedNicks = Array<string>(), //
                blockIllegalNicks, //
                restrictToCasLogin, //
                maxMembersPerGroup, //
                autoJoinToGroup, //
              }) {
    this.memberGroups = memberGroups;
    this.selectedNicks = selectedNicks;
    this.blockIllegalNicks = blockIllegalNicks;
    this.restrictToCasLogin = restrictToCasLogin;
    this.maxMembersPerGroup = maxMembersPerGroup;
    this.autoJoinToGroup = autoJoinToGroup;
  }

  public serialize(): INickSessionConfigurationSerialized {
    return {
      memberGroups: this.memberGroups,
      maxMembersPerGroup: this.maxMembersPerGroup,
      autoJoinToGroup: this.autoJoinToGroup,
      selectedNicks: this.selectedNicks,
      blockIllegalNicks: this.blockIllegalNicks,
      restrictToCasLogin: this.restrictToCasLogin,
    };
  }

  public equals(value: INickSessionConfigurationEntity): boolean {
    return this.memberGroups === value.memberGroups && //
           this.maxMembersPerGroup === value.maxMembersPerGroup && //
           this.autoJoinToGroup === value.autoJoinToGroup && //
           this.selectedNicks === value.selectedNicks && //
           this.blockIllegalNicks === value.blockIllegalNicks && //
           this.restrictToCasLogin === value.restrictToCasLogin;
  }

  public hasSelectedNick(nickname: string): boolean {
    return this.selectedNicks.indexOf(nickname) !== -1;
  }

  public toggleSelectedNick(nickname: string): void {
    if (this.hasSelectedNick(nickname)) {
      this.removeSelectedNickByName(nickname);
    } else {
      this.addSelectedNick(nickname);
    }
  }

  public addSelectedNick(newSelectedNick: string): void {
    if (this.hasSelectedNick(newSelectedNick)) {
      return;
    }
    this.selectedNicks.push(newSelectedNick);
  }

  public removeSelectedNickByName(selectedNick: string): void {
    const index = this.selectedNicks.indexOf(selectedNick);
    if (index === -1) {
      return;
    }
    this.selectedNicks.splice(index, 1);
  }
}
