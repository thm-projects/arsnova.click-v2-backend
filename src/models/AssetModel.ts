import { getModelForClass, index, prop } from '@typegoose/typegoose';
import DbDAO from '../db/DbDAO';
import { DbCollection } from '../enums/DbOperation';
import { IAssetSerialized } from '../interfaces/IAsset';
import LoggerService from '../services/LoggerService';

@index({ digest: 1 }, { unique: true })
export class AssetModelItem implements IAssetSerialized {
  @prop({
    required: true,
    _id: false,
  }) public data: Buffer;
  @prop() public digest: string;
  @prop() public url: string;
  @prop() public mimeType: string;
}

export const AssetModel = getModelForClass(AssetModelItem, {
  schemaOptions: {
    collection: DbCollection.Assets,
    timestamps: true,
  },
  existingConnection: DbDAO.dbCon,
});

AssetModel.collection.dropIndexes().then(() => AssetModel.createIndexes(err => {
  if (!err) {
    return;
  }

  LoggerService.error('Unique index for AssetModel created with error', err);
}));
