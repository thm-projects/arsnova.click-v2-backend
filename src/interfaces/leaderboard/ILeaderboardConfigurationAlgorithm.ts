import { ILeaderboardConfigurationParamterBonusAlgorithm } from './ILeaderboardConfigurationParamterBonusAlgorithm';

export interface ILeaderboardConfigurationAlgorithm {
  algorithm: string;
  parameters: {
    bonusForCorrect: number; bonusForTime: {
      onlyCorrect: boolean; parameter: Array<ILeaderboardConfigurationParamterBonusAlgorithm>;
    }
  };
}

