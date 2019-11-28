import { ObjectID, ObjectId } from 'bson';
import { DeleteWriteOpResultObject } from 'mongodb';
import { Document } from 'mongoose';
import { IAssetSerialized } from '../interfaces/IAsset';
import { AssetModel, AssetModelItem } from '../models/AssetModel';
import { AbstractDAO } from './AbstractDAO';

class AssetDAO extends AbstractDAO {
  public static getInstance(): AssetDAO {
    if (!this.instance) {
      this.instance = new AssetDAO();
    }

    return this.instance;
  }

  public addAsset(document: IAssetSerialized): Promise<Document & AssetModelItem> {
    return AssetModel.create(document);
  }

  public updateAsset(id: ObjectId, updatedFields: any): Promise<Document & AssetModelItem> {
    return AssetModel.findOneAndUpdate(id, updatedFields).exec();
  }

  public removeAllAssets(): Promise<DeleteWriteOpResultObject['result'] & { deletedCount?: number }> {
    return AssetModel.deleteMany({}).exec();
  }

  public removeAsset(id: ObjectId): Promise<DeleteWriteOpResultObject['result'] & { deletedCount?: number }> {
    return AssetModel.deleteOne({ _id: id }).exec();
  }

  public getAssetByDigest(digest: string): Promise<AssetModelItem> {
    return AssetModel.findOne({ digest }).exec();
  }

  public getAssetByUrl(url: string): Promise<AssetModelItem> {
    return AssetModel.findOne({ url }).exec();
  }

  public async getAssetByDigestAsLean(digest: string): Promise<IAssetSerialized> {
    return AssetModel.findOne({ digest }).lean().exec();
  }

  private getAssetById(id: ObjectID): Promise<AssetModelItem> {
    return AssetModel.findById({ id }).exec();
  }
}

export default AssetDAO.getInstance();
