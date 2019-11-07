import { ObjectID, ObjectId } from 'bson';
import { AssetEntity } from '../entities/AssetEntity';
import { DbCollection, DbEvent } from '../enums/DbOperation';
import { IAsset, IAssetSerialized } from '../interfaces/IAsset';
import LoggerService from '../services/LoggerService';
import { AbstractDAO } from './AbstractDAO';
import DbDAO from './DbDAO';

class AssetDAO extends AbstractDAO<Array<AssetEntity>> {

  constructor() {
    super([]);

    DbDAO.isDbAvailable.on(DbEvent.Connected, async (isConnected) => {
      if (isConnected) {
        const cursor = DbDAO.readMany(DbCollection.Assets, {});
        cursor.forEach(doc => {
          this.addAsset(doc);
        }).then(() => LoggerService.info(`${this.constructor.name} initialized with ${this.storage.length} entries`));
      }
    });
  }

  public static getInstance(): AssetDAO {
    if (!this.instance) {
      this.instance = new AssetDAO();
    }

    return this.instance;
  }

  public addAsset(document: IAssetSerialized): void {
    if (this.getAssetById(new ObjectId(document.id))) {
      throw new Error(`Duplicate asset insertion: (id: ${document.id}, url: ${document.url})`);
    }

    const asset = new AssetEntity(document);
    this.storage.push(asset);
    this.updateEmitter.emit(DbEvent.Create, asset);
  }

  public updateAsset(id: ObjectId, updatedFields: any): void {
    const asset = this.getAssetById(id);
    if (!asset) {
      throw new Error(`Unkown updated quiz: ${id.toHexString()}`);
    }

    Object.keys(updatedFields).forEach(key => asset[key] = updatedFields[key]);

    this.updateEmitter.emit(DbEvent.Change, asset);
  }

  public removeAllAssets(): void {
    this.storage.forEach(asset => this.updateEmitter.emit(DbEvent.Delete, asset));
    this.storage.splice(0, this.storage.length);
  }

  public removeAsset(id: ObjectId): void {
    this.storage.splice(this.storage.findIndex(asset => asset.id.equals(id)), 1);
  }

  public getAssetByDigest(digest: string): IAsset {
    return this.storage.find(val => val.digest === digest);
  }

  public getAssetByUrl(url: string): IAsset {
    return this.storage.find(asset => asset.url === url);
  }

  private getAssetById(id: ObjectID): IAsset {
    return this.storage.find(asset => asset.id.equals(id));
  }
}

export default AssetDAO.getInstance();
