import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common"
import type { Repository, EntityManager } from "typeorm"
import type { VirtualItem } from "../entities/virtual-item.entity"
import { InventoryItem } from "../entities/inventory-item.entity"
import { MarketListing, ListingStatus } from "../entities/market-listing.entity"
import type { CreateVirtualItemDto } from "../dto/create-item.dto"
import type { CreateMarketListingDto } from "../dto/create-listing.dto"
import type { BuyItemDto } from "../dto/buy-item.dto"
import type { EconomyCacheService } from "./economy-cache.service"
import type { VirtualCurrencyService } from "./virtual-currency.service"
import { Decimal } from "decimal.js"

@Injectable()
export class MarketplaceService {
  private virtualItemRepository: Repository<VirtualItem>
  private inventoryItemRepository: Repository<InventoryItem>
  private marketListingRepository: Repository<MarketListing>
  private entityManager: EntityManager
  private economyCacheService: EconomyCacheService
  private virtualCurrencyService: VirtualCurrencyService

  constructor(
    virtualItemRepository: Repository<VirtualItem>,
    inventoryItemRepository: Repository<InventoryItem>,
    marketListingRepository: Repository<MarketListing>,
    entityManager: EntityManager,
    economyCacheService: EconomyCacheService,
    virtualCurrencyService: VirtualCurrencyService,
  ) {
    this.virtualItemRepository = virtualItemRepository
    this.inventoryItemRepository = inventoryItemRepository
    this.marketListingRepository = marketListingRepository
    this.entityManager = entityManager
    this.economyCacheService = economyCacheService
    this.virtualCurrencyService = virtualCurrencyService
  }

  async createVirtualItem(createItemDto: CreateVirtualItemDto): Promise<VirtualItem> {
    const existingItem = await this.virtualItemRepository.findOne({
      where: { name: createItemDto.name },
    })
    if (existingItem) {
      throw new ConflictException(`Virtual item with name "${createItemDto.name}" already exists.`)
    }
    const item = this.virtualItemRepository.create(createItemDto)
    const savedItem = await this.virtualItemRepository.save(item)
    await this.economyCacheService.cacheVirtualItem(savedItem)
    return savedItem
  }

  async getVirtualItem(itemId: string): Promise<VirtualItem> {
    let item = await this.economyCacheService.getVirtualItem(itemId)
    if (!item) {
      item = await this.virtualItemRepository.findOne({ where: { id: itemId } })
      if (!item) {
        throw new NotFoundException(`Virtual item with ID "${itemId}" not found.`)
      }
      await this.economyCacheService.cacheVirtualItem(item)
    }
    return item
  }

  async updateVirtualItemPrice(itemId: string, newPrice: string): Promise<void> {
    await this.economyCacheService.setItemPrice(itemId, newPrice)
  }

  async getMarketPrice(itemId: string): Promise<string> {
    const cachedPrice = await this.economyCacheService.getItemPrice(itemId)
    if (cachedPrice) {
      return cachedPrice
    }

    const item = await this.getVirtualItem(itemId)
    // Basic market dynamics: average of last 5 active listings, or base price if no listings
    const recentListings = await this.marketListingRepository.find({
      where: { itemId, listingStatus: ListingStatus.ACTIVE },
      order: { listedAt: "DESC" },
      take: 5,
    })

    if (recentListings.length > 0) {
      const totalPrices = recentListings.reduce((sum, listing) => sum.plus(listing.price), new Decimal(0))
      const averagePrice = totalPrices.dividedBy(recentListings.length).toFixed(4)
      await this.economyCacheService.setItemPrice(itemId, averagePrice)
      return averagePrice
    }

    // Fallback to base price if no active listings
    await this.economyCacheService.setItemPrice(itemId, item.basePrice)
    return item.basePrice
  }

  async createMarketListing(createListingDto: CreateMarketListingDto): Promise<MarketListing> {
    const { itemId, sellerId, quantity, price, currencyCode } = createListingDto

    // Check if seller has the item in inventory
    const inventoryItem = await this.inventoryItemRepository.findOne({
      where: { userId: sellerId, itemId },
    })

    if (!inventoryItem || inventoryItem.quantity < quantity) {
      throw new BadRequestException(`Seller does not have enough of item ${itemId} in inventory.`)
    }

    // Create listing
    const listing = this.marketListingRepository.create({
      itemId,
      sellerId,
      quantity,
      price,
      currencyCode,
      listingStatus: ListingStatus.ACTIVE,
    })

    return this.entityManager.transaction(async (transactionalEntityManager) => {
      // Deduct items from seller's inventory
      inventoryItem.quantity -= quantity
      if (inventoryItem.quantity === 0) {
        await transactionalEntityManager.remove(InventoryItem, inventoryItem)
      } else {
        await transactionalEntityManager.save(InventoryItem, inventoryItem)
      }

      const savedListing = await transactionalEntityManager.save(MarketListing, listing)
      return savedListing
    })
  }

  async buyItem(buyerId: string, buyItemDto: BuyItemDto): Promise<MarketListing> {
    const { listingId, quantity } = buyItemDto

    return this.entityManager.transaction(async (transactionalEntityManager) => {
      const listing = await transactionalEntityManager
        .findOne(MarketListing, {
          where: { id: listingId, listingStatus: ListingStatus.ACTIVE },
          relations: ["item"],
          lock: { mode: "for_update" }, // Lock the listing
        })
        .then((l) => {
          if (!l) {
            throw new NotFoundException(`Market listing with ID "${listingId}" not found or is not active.`)
          }
          return l
        })

      if (listing.quantity < quantity) {
        throw new BadRequestException(
          `Not enough items available in listing. Available: ${listing.quantity}, Requested: ${quantity}`,
        )
      }

      const totalCost = new Decimal(listing.price).times(quantity).toFixed(4)
      const marketplaceFeeRate = new Decimal("0.05") // 5% fee
      const marketplaceFee = new Decimal(totalCost).times(marketplaceFeeRate).toFixed(4)
      const sellerReceives = new Decimal(totalCost).minus(marketplaceFee).toFixed(4)

      // 1. Deduct currency from buyer
      await this.virtualCurrencyService.withdraw(
        buyerId,
        listing.currencyCode,
        totalCost,
        `Purchase of ${quantity}x ${listing.item.name} from listing ${listing.id}`,
        { listingId, itemId: listing.itemId, quantity, sellerId: listing.sellerId },
      )

      // 2. Credit currency to seller (after fee)
      await this.virtualCurrencyService.deposit(
        listing.sellerId,
        listing.currencyCode,
        sellerReceives,
        `Sale of ${quantity}x ${listing.item.name} from listing ${listing.id}`,
        { listingId, itemId: listing.itemId, quantity, buyerId },
      )

      // 3. Credit marketplace fee to system
      await this.virtualCurrencyService.deposit(
        "SYSTEM_MARKETPLACE_FEE", // A designated system account for fees
        listing.currencyCode,
        marketplaceFee,
        `Marketplace fee for listing ${listing.id}`,
        { listingId, itemId: listing.itemId, quantity, buyerId, sellerId: listing.sellerId },
      )

      // 4. Transfer item to buyer's inventory
      let buyerInventoryItem = await transactionalEntityManager.findOne(InventoryItem, {
        where: { userId: buyerId, itemId: listing.itemId },
      })

      if (buyerInventoryItem) {
        buyerInventoryItem.quantity += quantity
        await transactionalEntityManager.save(InventoryItem, buyerInventoryItem)
      } else {
        buyerInventoryItem = transactionalEntityManager.create(InventoryItem, {
          userId: buyerId,
          itemId: listing.itemId,
          quantity,
        })
        await transactionalEntityManager.save(InventoryItem, buyerInventoryItem)
      }

      // 5. Update listing status and quantity
      listing.quantity -= quantity
      if (listing.quantity === 0) {
        listing.listingStatus = ListingStatus.SOLD
        listing.soldAt = new Date()
      }
      await transactionalEntityManager.save(MarketListing, listing)

      // Invalidate item price cache as supply/demand changed
      await this.economyCacheService.removeItemPrice(listing.itemId)

      return listing
    })
  }

  async cancelMarketListing(listingId: string, sellerId: string): Promise<MarketListing> {
    return this.entityManager.transaction(async (transactionalEntityManager) => {
      const listing = await transactionalEntityManager
        .findOne(MarketListing, {
          where: { id: listingId, sellerId, listingStatus: ListingStatus.ACTIVE },
          lock: { mode: "for_update" },
        })
        .then((l) => {
          if (!l) {
            throw new NotFoundException(`Active listing with ID "${listingId}" by seller "${sellerId}" not found.`)
          }
          return l
        })

      listing.listingStatus = ListingStatus.CANCELLED
      const updatedListing = await transactionalEntityManager.save(MarketListing, listing)

      // Return items to seller's inventory
      let sellerInventoryItem = await transactionalEntityManager.findOne(InventoryItem, {
        where: { userId: sellerId, itemId: listing.itemId },
      })

      if (sellerInventoryItem) {
        sellerInventoryItem.quantity += listing.quantity
        await transactionalEntityManager.save(InventoryItem, sellerInventoryItem)
      } else {
        sellerInventoryItem = transactionalEntityManager.create(InventoryItem, {
          userId: sellerId,
          itemId: listing.itemId,
          quantity: listing.quantity,
        })
        await transactionalEntityManager.save(InventoryItem, sellerInventoryItem)
      }

      // Invalidate item price cache
      await this.economyCacheService.removeItemPrice(listing.itemId)

      return updatedListing
    })
  }

  async getUserInventory(userId: string): Promise<InventoryItem[]> {
    return this.inventoryItemRepository.find({
      where: { userId },
      relations: ["item"],
    })
  }

  async getActiveMarketListings(itemId?: string): Promise<MarketListing[]> {
    const where: any = { listingStatus: ListingStatus.ACTIVE }
    if (itemId) {
      where.itemId = itemId
    }
    return this.marketListingRepository.find({
      where,
      relations: ["item"],
      order: { price: "ASC", listedAt: "ASC" },
    })
  }
}
