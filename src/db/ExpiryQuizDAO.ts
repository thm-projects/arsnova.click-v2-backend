import { IQuestionGroup } from 'arsnova-click-v2-types/src/questions/interfaces';
import { AbstractDAO } from './AbstractDAO';

class ExpiryQuizDAO extends AbstractDAO<IQuestionGroup> {
  private _expiry: Date;

  get expiry(): Date {
    return this._expiry;
  }

  constructor(storage: IQuestionGroup) {
    super(storage);
  }

  public static getInstance(): ExpiryQuizDAO {
    if (!this.instance) {
      this.instance = new ExpiryQuizDAO(null);
    }
    return this.instance;
  }

  public getCurrentQuestionGroup(): IQuestionGroup {
    if (!this.expiry || !this.storage || new Date().getTime() >= this.expiry.getTime()) {
      this._storage = null;
      this._expiry = null;
      return null;
    }
    return this.storage;
  }

  public setQuestionGroup(storage: IQuestionGroup, expiry: Date): void {
    if (!storage || !expiry) {
      throw new Error(`Unsupported vars for setting the question group. Storage was: ${JSON.stringify(storage)}, expiry was: ${expiry}`);
    }

    this._storage = storage;
    this._expiry = expiry;
  }

  public createDump(): any {
    return super.createDump();
  }
}

export default ExpiryQuizDAO.getInstance();
