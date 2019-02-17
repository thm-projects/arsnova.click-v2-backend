import { ILeaderboardConfigurationParamterBonusAlgorithm } from './ILeaderboardConfigurationParamterBonusAlgorithm';

export interface ILeaderboardConfigurationAlgorithm {
  algorithm: string;
  parameters: {
    bonusForCorrect: number; //
    bonusForPartiallyCorrect: number; //
    bonusForWrong: number; //
    bonusForTime: {
      onlyCorrect: boolean; //
      parameter: Array<ILeaderboardConfigurationParamterBonusAlgorithm>;
    }
  };
}

