import { Injectable } from "@nestjs/common"
import type { Cache } from "cache-manager"
import type { VirtualItem } from "../entities/virtual-item.entity"

@Injectable()
export class EconomyCacheService {
  private readonly ITEM_PRICE_PREFIX = "item:price:"
  private readonly CACHE_TTL = 3600 // 1 hour for general data

  constructor(private cacheManager: Cache) {}

  async setItemPrice(itemId: string, price: string, ttl = 60): Promise<void> {
    // TTL for prices can be shorter for real-time dynamics
    const key = `${this.ITEM_PRICE_PREFIX}${itemId}`
    await this.cacheManager.set(key, price, ttl)
  }

  async getItemPrice(itemId: string): Promise<string | null> {
    const key = `${this.ITEM_PRICE_PREFIX}${itemId}`
    return this.cacheManager.get<string>(key)
  }

  async removeItemPrice(itemId: string): Promise<void> {
    const key = `${this.ITEM_PRICE_PREFIX}${itemId}`
    await this.cacheManager.del(key)
  }

  async cacheVirtualItem(item: VirtualItem): Promise<void> {
    const key = `virtual_item:${item.id}`
    await this.cacheManager.set(key, item, this.CACHE_TTL)
  }

  async getVirtualItem(itemId: string): Promise<VirtualItem | null> {
    const key = `virtual_item:${itemId}`
    return this.cacheManager.get<VirtualItem>(key)
  }

  async invalidateVirtualItem(itemId: string): Promise<void> {
    const key = `virtual_item:${itemId}`
    await this.cacheManager.del(key)
  }
}
