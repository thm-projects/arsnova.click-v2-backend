export abstract class AbstractDAO<T> {
  protected static instance;
  public readonly storage: T;

  protected constructor(storage: T) {
    this.storage = storage;
  }

  public createDump(): any {
    return this.storage;
  }

  protected isEmptyVars(...variables): boolean {
    return variables.filter(variable => !this.isNotEmptyVar(variable)).length === 0;
  }

  private isNotEmptyVar(variable: any): boolean {
    return typeof variable !== 'undefined' && String(variable).length > 0;
  }
}
