import { ILeaderboardConfigurationParamterBonusAlgorithm } from './ILeaderboardConfigurationParamterBonusAlgorithm';

export interface ILeaderboardConfigurationAlgorithm {
  algorithm: string;
  parameter: {
    bonusForCorrect: number; bonusForTime: {
      onlyCorrect: boolean; parameter: Array<ILeaderboardConfigurationParamterBonusAlgorithm>;
    }
  };
}

