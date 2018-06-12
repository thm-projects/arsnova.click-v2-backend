import { ICasData } from 'arsnova-click-v2-types/src/common';

export class CasDAO {

  private static readonly casData = {};

  public static add(ticket: string, data: ICasData): void {
    this.casData[ticket] = data;
  }

  public static match(ticket: string): ICasData {
    return this.casData[ticket];
  }

  public static remove(ticket: string): void {
    delete this.casData[ticket];
  }

  public static createDump(): {} {
    return CasDAO.casData;
  }
}
