import { INickSessionConfigurationSerialized } from './INickSessionConfigurationSerialized';

export interface INickSessionConfigurationEntity extends INickSessionConfigurationSerialized {
  serialize(): INickSessionConfigurationSerialized;

  equals(value: INickSessionConfigurationSerialized): boolean;

  hasSelectedNick(nickname: string): boolean;

  toggleSelectedNick(nickname: string): void;

  addSelectedNick(newSelectedNick: string): void;

  removeSelectedNickByName(selectedNick: string): void;
}
