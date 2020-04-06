import { ICasData } from '../interfaces/users/ICasData';
import { AbstractDAO } from './AbstractDAO';

class CasDAO extends AbstractDAO {
  private _storage: object = {};

  get storage(): object {
    return this._storage;
  }

  public static getInstance(): CasDAO {
    if (!this.instance) {
      this.instance = new CasDAO();
    }
    return this.instance;
  }

  public async getStatistics(): Promise<{ [key: string]: number }> {
    return {};
  }

  public add(ticket: string, data: ICasData): void {
    this.storage[ticket] = data;
  }

  public match(ticket: string): ICasData {
    return this.storage[ticket];
  }

  public remove(ticket: string): void {
    delete this.storage[ticket];
  }
}

export default CasDAO.getInstance();
