import { Binary } from 'bson';
import { index, prop, Typegoose } from 'typegoose';
import AssetDAO from '../db/AssetDAO';
import DbDAO from '../db/DbDAO';
import { DbCollection, DbEvent, DbWatchStreamOperation } from '../enums/DbOperation';
import { IAssetSerialized } from '../interfaces/IAsset';
import LoggerService from '../services/LoggerService';

@index({ name: 1 }, { unique: true })
export class AssetModelItem extends Typegoose implements IAssetSerialized {
  @prop() public data: Binary;
  @prop() public digest: string;
  @prop() public url: string;
}

export const AssetModel = new AssetModelItem().getModelForClass(AssetModelItem, {
  schemaOptions: {
    collection: DbCollection.Assets,
    timestamps: true,
  },
  existingConnection: DbDAO.dbCon,
});

AssetModel.createIndexes(err => {
  if (!err) {
    return;
  }

  LoggerService.error('Unique index for AssetModel created with error', err);
});

const eventCallback = data => {

  switch (data.operationType) {
    case DbWatchStreamOperation.Insert:
      LoggerService.info(`Inserting new AssetModel: ${JSON.stringify(data.fullDocument.url)}`);
      AssetDAO.addAsset(data.fullDocument);
      break;
    case DbWatchStreamOperation.Update:
      LoggerService.info(`Updating existing AssetModel: ${data.documentKey._id}, ${JSON.stringify(data.updateDescription.updatedFields)}`);
      AssetDAO.updateAsset(data.documentKey._id, data.updateDescription.updatedFields);
      break;
    case DbWatchStreamOperation.Invalidate:
      LoggerService.info(`Invalidating AssetModel storage`);
      AssetDAO.removeAllAssets();
      attachEventCallback();
      break;
    case DbWatchStreamOperation.Delete:
      LoggerService.info(`Deleting asset: ${data.documentKey._id}`);
      AssetDAO.removeAsset(data.documentKey._id);
      break;
    default:
      LoggerService.error(`Unknown db operationType '${data.operationType}' in change listener of AssetModel`);
  }
};

function attachEventCallback(): void {
  AssetModel.watch().on(DbEvent.Change, eventCallback);
}

attachEventCallback();
