import { IStorageDAO } from 'arsnova-click-v2-types/src/common';

export abstract class AbstractDAO<T> implements IStorageDAO<T> {
  protected static instance;

  protected _storage: T;

  get storage(): T {
    return this._storage;
  }

  protected constructor(storage: T) {
    this._storage = storage;
  }

  public createDump(): any {
    return this.storage;
  }

  protected isEmptyVars(...variables): boolean {
    return variables.length > 0 && variables.filter(variable => AbstractDAO.isEmptyVar(variable)).length > 0;
  }

  private static isEmptyVar(variable: any): boolean {
    return typeof variable === 'undefined' || AbstractDAO.getLengthOfVar(variable) === 0;
  }

	private static getLengthOfVar(variable: any): number {
    switch (typeof variable) {
      case 'string':
        return variable.length;
      case 'object':
        if (variable instanceof Array) {
          return variable.length;
        }
        return Object.keys(variable).length;
      default:
        return String(variable).length;
    }
  }
}
