import { ObjectId } from 'bson';
import { IAssetSerialized } from '../interfaces/IAsset';
import { AbstractEntity } from './AbstractEntity';

export class AssetEntity extends AbstractEntity {
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

  private _data: Uint8Array;

  get data(): Uint8Array {
    return this._data;
  }

  set data(value: Uint8Array) {
    this._data = value;
  }

  private _mimeType: string;

  get mimeType(): string {
    return this._mimeType;
  }

  set mimeType(value: string) {
    this._mimeType = value;
  }

  constructor(data: IAssetSerialized) {
    super();

    this._id = new ObjectId(data.id || data._id);
    this._url = data.url;
    this._digest = data.digest;
    this._data = data.data;
    this._mimeType = data.mimeType;
  }

  public serialize(): IAssetSerialized {
    return {
      id: this.id.toHexString(),
      url: this.url,
      digest: this.digest,
      data: this.data,
      mimeType: this.mimeType,
    };
  }
}
