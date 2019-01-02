import { Binary, ObjectId } from 'bson';

export interface IAssetSerialized extends IAssetBase {
  id?: string;
  _id?: string;
}

export interface IAsset extends IAssetBase {
  id: ObjectId;
}

export interface IAssetBase {
  url: string;
  digest: string;
  data: Binary;
}
