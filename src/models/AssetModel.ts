import { getModelForClass, index, prop, Severity } from '@typegoose/typegoose';
import { IsArray, IsString } from 'class-validator';
import DbDAO from '../db/DbDAO';
import { DbCollection } from '../enums/DbOperation';
import { IAssetSerialized } from '../interfaces/IAsset';

@index({ digest: 1 }, { unique: true })
export class AssetModelItem implements IAssetSerialized {
  @prop({
    required: true,
    _id: false,
  }) @IsArray() public data: Buffer;
  @prop() @IsString() public digest: string;
  @prop() @IsString() public url: string;
  @prop() @IsString() public mimeType: string;
}

export const AssetModel = getModelForClass(AssetModelItem, {
  schemaOptions: {
    collection: DbCollection.Assets,
    timestamps: true,
  },
  existingConnection: DbDAO.dbCon,
  options: {
    runSyncIndexes: true,
    allowMixed: Severity.ALLOW,
  },
});
