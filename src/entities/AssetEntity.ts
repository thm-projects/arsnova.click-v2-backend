import { Binary, ObjectId } from 'bson';
import { IEntity } from '../interfaces/entities/IEntity';
import { IAssetSerialized } from '../interfaces/IAsset';
import { AbstractEntity } from './AbstractEntity';

export class AssetEntity extends AbstractEntity implements IEntity {
  private _url: string;

  get url(): string {
    return this._url;
  }

  set url(value: string) {
    this._url = value;
  }

  private _digest: string;

  get digest(): string {
    return this._digest;
  }

  set digest(value: string) {
    this._digest = value;
  }

  private _data: Binary;

  get data(): Binary {
    return this._data;
  }

  set data(value: Binary) {
    this._data = value;
  }

  constructor(data: IAssetSerialized) {
    super();

    this._id = new ObjectId(data.id || data._id);
    this._url = data.url;
    this._digest = data.digest;
    this._data = data.data;
  }

  public serialize(): IAssetSerialized {
    return {
      id: this.id.toHexString(),
      url: this.url,
      digest: this.digest,
      data: this.data,
    };
  }
}
