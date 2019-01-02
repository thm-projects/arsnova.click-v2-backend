export interface IStorageDAO<T> {
  createDump(): T | Array<T>;
}
