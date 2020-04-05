import { EventEmitter } from 'events';

export abstract class AbstractDAO {
  protected static instance;

  protected _isInitialized: boolean;

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  private _updateEmitter = new EventEmitter();

  get updateEmitter(): NodeJS.EventEmitter {
    return this._updateEmitter;
  }

  public abstract async getStatistics(): Promise<{ [key: string]: number }>;

  protected isEmptyVars(...variables): boolean {
    return variables.length > 0 && variables.filter(variable => this.isEmptyVar(variable)).length > 0;
  }

  private isEmptyVar(variable: any): boolean {
    return typeof variable === 'undefined' || this.getLengthOfVar(variable) === 0;
  }

  private getLengthOfVar(variable: any): number {
    switch (typeof variable) {
      case 'string':
        return variable.length;
      case 'object':
        if (Array.isArray(variable)) {
          return variable.length;
        }
        return Object.keys(variable).length;
      default:
        return String(variable).length;
    }
  }
}
