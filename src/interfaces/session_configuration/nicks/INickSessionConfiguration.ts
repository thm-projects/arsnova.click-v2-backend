import { IMemberGroupBase } from '../../users/IMemberGroupBase';

export interface INickSessionConfiguration {
  memberGroups: Array<IMemberGroupBase>;
  maxMembersPerGroup: number;
  autoJoinToGroup: boolean;
  selectedNicks: Array<string>;
  blockIllegalNicks: boolean;
  restrictToCasLogin: boolean;
}
