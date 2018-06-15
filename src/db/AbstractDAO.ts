export abstract class AbstractDAO<T> {
  protected static instance;
  public readonly storage: T;

  protected constructor(storage: T) {
    this.storage = storage;
  }

  public createDump(): any {
    return this.storage;
  }
}
