import { ICasData } from 'arsnova-click-v2-types/src/common';
import { AbstractDAO } from './AbstractDAO';

class CasDAO extends AbstractDAO<{ [key: string]: ICasData }> {

  public static getInstance(): CasDAO {
    if (!this.instance) {
      this.instance = new CasDAO({});
    }
    return this.instance;
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
