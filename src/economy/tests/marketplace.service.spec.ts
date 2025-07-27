import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository, EntityManager } from "typeorm"
import { MarketplaceService } from "../services/marketplace.service"
import { VirtualCurrencyService } from "../services/virtual-currency.service"
import { EconomyCacheService } from "../services/economy-cache.service"
import { VirtualItem, ItemType } from "../entities/virtual-item.entity"
import { InventoryItem } from "../entities/inventory-item.entity"
import { MarketListing, ListingStatus } from "../entities/market-listing.entity"
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common"
import { jest } from "@jest/globals"
import { Decimal } from "decimal.js"

describe("MarketplaceService", () => {
  let service: MarketplaceService
  let virtualItemRepository: Repository<VirtualItem>
  let inventoryItemRepository: Repository<InventoryItem>
  let marketListingRepository: Repository<MarketListing>
  let entityManager: EntityManager
  let economyCacheService: EconomyCacheService
  let virtualCurrencyService: VirtualCurrencyService

  const mockVirtualItemRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  }

  const mockInventoryItemRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
  }

  const mockMarketListingRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  }

  const mockEntityManager = {
    transaction: jest.fn((cb) => cb(mockEntityManager)),
    findOne: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  }

  const mockEconomyCacheService = {
    setItemPrice: jest.fn(),
    getItemPrice: jest.fn(),
    removeItemPrice: jest.fn(),
    cacheVirtualItem: jest.fn(),
    getVirtualItem: jest.fn(),
    invalidateVirtualItem: jest.fn(),
  }

  const mockVirtualCurrencyService = {
    deposit: jest.fn(),
    withdraw: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        {
          provide: getRepositoryToken(VirtualItem),
          useValue: mockVirtualItemRepository,
        },
        {
          provide: getRepositoryToken(InventoryItem),
          useValue: mockInventoryItemRepository,
        },
        {
          provide: getRepositoryToken(MarketListing),
          useValue: mockMarketListingRepository,
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
        {
          provide: EconomyCacheService,
          useValue: mockEconomyCacheService,
        },
        {
          provide: VirtualCurrencyService,
          useValue: mockVirtualCurrencyService,
        },
      ],
    }).compile()

    service = module.get<MarketplaceService>(MarketplaceService)
    virtualItemRepository = module.get<Repository<VirtualItem>>(getRepositoryToken(VirtualItem))
    inventoryItemRepository = module.get<Repository<InventoryItem>>(getRepositoryToken(InventoryItem))
    marketListingRepository = module.get<Repository<MarketListing>>(getRepositoryToken(MarketListing))
    entityManager = module.get<EntityManager>(EntityManager)
    economyCacheService = module.get<EconomyCacheService>(EconomyCacheService)
    virtualCurrencyService = module.get<VirtualCurrencyService>(VirtualCurrencyService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const mockItem = {
    id: "item-1",
    name: "Sword of Awesomeness",
    itemType: ItemType.EQUIPMENT,
    basePrice: "100.0000",
  }

  const mockInventoryItem = {
    id: "inv-1",
    userId: "seller-1",
    itemId: "item-1",
    quantity: 5,
  }

  const mockListing = {
    id: "listing-1",
    itemId: "item-1",
    sellerId: "seller-1",
    quantity: 3,
    price: "120.0000",
    currencyCode: "GOLD",
    listingStatus: ListingStatus.ACTIVE,
    item: mockItem, // For relations
  }

  describe("createVirtualItem", () => {
    it("should create a virtual item successfully", async () => {
      const createDto = {
        name: "New Potion",
        itemType: ItemType.CONSUMABLE,
        basePrice: "5.0000",
      }
      mockVirtualItemRepository.findOne.mockResolvedValue(null)
      mockVirtualItemRepository.create.mockReturnValue(mockItem)
      mockVirtualItemRepository.save.mockResolvedValue(mockItem)

      const result = await service.createVirtualItem(createDto)

      expect(result).toEqual(mockItem)
      expect(mockVirtualItemRepository.findOne).toHaveBeenCalledWith({
        where: { name: createDto.name },
      })
      expect(mockVirtualItemRepository.create).toHaveBeenCalledWith(createDto)
      expect(mockVirtualItemRepository.save).toHaveBeenCalledWith(mockItem)
      expect(mockEconomyCacheService.cacheVirtualItem).toHaveBeenCalledWith(mockItem)
    })

    it("should throw ConflictException if item name already exists", async () => {
      const createDto = {
        name: "Sword of Awesomeness",
        itemType: ItemType.EQUIPMENT,
        basePrice: "100.0000",
      }
      mockVirtualItemRepository.findOne.mockResolvedValue(mockItem)

      await expect(service.createVirtualItem(createDto)).rejects.toThrow(ConflictException)
    })
  })

  describe("getMarketPrice", () => {
    it("should return cached price if available", async () => {
      mockEconomyCacheService.getItemPrice.mockResolvedValue("110.0000")

      const result = await service.getMarketPrice("item-1")

      expect(result).toBe("110.0000")
      expect(mockEconomyCacheService.getItemPrice).toHaveBeenCalledWith("item-1")
      expect(mockVirtualItemRepository.findOne).not.toHaveBeenCalled()
    })

    it("should calculate average price from active listings if no cache", async () => {
      mockEconomyCacheService.getItemPrice.mockResolvedValue(null)
      mockEconomyCacheService.getVirtualItem.mockResolvedValue(mockItem)
      mockMarketListingRepository.find.mockResolvedValue([
        { price: "120.0000" },
        { price: "130.0000" },
        { price: "110.0000" },
      ])

      const result = await service.getMarketPrice("item-1")

      expect(result).toBe("120.0000") // (120+130+110)/3 = 120
      expect(mockEconomyCacheService.setItemPrice).toHaveBeenCalledWith("item-1", "120.0000")
    })

    it("should return base price if no active listings and no cache", async () => {
      mockEconomyCacheService.getItemPrice.mockResolvedValue(null)
      mockEconomyCacheService.getVirtualItem.mockResolvedValue(mockItem)
      mockMarketListingRepository.find.mockResolvedValue([])

      const result = await service.getMarketPrice("item-1")

      expect(result).toBe(mockItem.basePrice)
      expect(mockEconomyCacheService.setItemPrice).toHaveBeenCalledWith("item-1", mockItem.basePrice)
    })
  })

  describe("createMarketListing", () => {
    it("should create a market listing and deduct from inventory", async () => {
      const createDto = {
        itemId: "item-1",
        sellerId: "seller-1",
        quantity: 2,
        price: "120.0000",
        currencyCode: "GOLD",
      }
      const expectedInventoryQuantity = 3 // 5 - 2
      const mockSavedListing = { ...mockListing, quantity: 2 }

      mockInventoryItemRepository.findOne.mockResolvedValue({ ...mockInventoryItem })
      mockEntityManager.create.mockReturnValue(mockSavedListing)
      mockEntityManager.save
        .mockResolvedValueOnce({ ...mockInventoryItem, quantity: expectedInventoryQuantity })
        .mockResolvedValueOnce(mockSavedListing)

      const result = await service.createMarketListing(createDto)

      expect(result).toEqual(mockSavedListing)
      expect(mockInventoryItemRepository.findOne).toHaveBeenCalledWith({
        where: { userId: createDto.sellerId, itemId: createDto.itemId },
      })
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        InventoryItem,
        expect.objectContaining({ quantity: expectedInventoryQuantity }),
      )
      expect(mockEntityManager.save).toHaveBeenCalledWith(MarketListing, mockSavedListing)
    })

    it("should throw BadRequestException if seller does not have enough items", async () => {
      const createDto = {
        itemId: "item-1",
        sellerId: "seller-1",
        quantity: 10,
        price: "120.0000",
        currencyCode: "GOLD",
      }
      mockInventoryItemRepository.findOne.mockResolvedValue({ ...mockInventoryItem, quantity: 5 }) // Only 5 available

      await expect(service.createMarketListing(createDto)).rejects.toThrow(BadRequestException)
    })
  })

  describe("buyItem", () => {
    it("should buy an item, transfer currency, and update inventory/listing", async () => {
      const buyerId = "buyer-1"
      const buyDto = { listingId: "listing-1", quantity: 1 }
      const totalCost = "120.0000"
      const marketplaceFee = new Decimal(totalCost).times("0.05").toFixed(4) // 5% fee
      const sellerReceives = new Decimal(totalCost).minus(marketplaceFee).toFixed(4)

      const mockUpdatedListing = { ...mockListing, quantity: 2 } // 3 - 1
      const mockBuyerInventoryItem = {
        id: "inv-buyer-1",
        userId: buyerId,
        itemId: "item-1",
        quantity: 1,
      }

      mockEntityManager.findOne.mockResolvedValueOnce({ ...mockListing }) // Listing
      mockEntityManager.findOne.mockResolvedValueOnce(null) // Buyer's inventory item (new)
      mockEntityManager.save
        .mockResolvedValueOnce(mockBuyerInventoryItem) // Save new inventory item
        .mockResolvedValueOnce(mockUpdatedListing) // Save updated listing

      mockVirtualCurrencyService.withdraw.mockResolvedValue(true)
      mockVirtualCurrencyService.deposit.mockResolvedValue(true)

      const result = await service.buyItem(buyerId, buyDto)

      expect(result).toEqual(mockUpdatedListing)
      expect(mockEntityManager.findOne).toHaveBeenCalledWith(
        MarketListing,
        expect.objectContaining({
          where: { id: buyDto.listingId, listingStatus: ListingStatus.ACTIVE },
          lock: { mode: "for_update" },
        }),
      )
      expect(mockVirtualCurrencyService.withdraw).toHaveBeenCalledWith(
        buyerId,
        mockListing.currencyCode,
        totalCost,
        expect.any(String),
        expect.any(Object),
      )
      expect(mockVirtualCurrencyService.deposit).toHaveBeenCalledWith(
        mockListing.sellerId,
        mockListing.currencyCode,
        sellerReceives,
        expect.any(String),
        expect.any(Object),
      )
      expect(mockVirtualCurrencyService.deposit).toHaveBeenCalledWith(
        "SYSTEM_MARKETPLACE_FEE",
        mockListing.currencyCode,
        marketplaceFee,
        expect.any(String),
        expect.any(Object),
      )
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        InventoryItem,
        expect.objectContaining({ userId: buyerId, itemId: mockListing.itemId, quantity: 1 }),
      )
      expect(mockEntityManager.save).toHaveBeenCalledWith(InventoryItem, expect.any(InventoryItem))
      expect(mockEntityManager.save).toHaveBeenCalledWith(MarketListing, expect.objectContaining({ quantity: 2 }))
      expect(mockEconomyCacheService.removeItemPrice).toHaveBeenCalledWith(mockListing.itemId)
    })

    it("should throw BadRequestException if not enough items in listing", async () => {
      const buyerId = "buyer-1"
      const buyDto = { listingId: "listing-1", quantity: 5 } // Request 5, but listing has 3
      mockEntityManager.findOne.mockResolvedValue({ ...mockListing, quantity: 3 })

      await expect(service.buyItem(buyerId, buyDto)).rejects.toThrow(BadRequestException)
    })
  })

  describe("cancelMarketListing", () => {
    it("should cancel a listing and return items to seller's inventory", async () => {
      const sellerId = "seller-1"
      const listingId = "listing-1"
      const mockUpdatedListing = { ...mockListing, listingStatus: ListingStatus.CANCELLED }
      const expectedInventoryQuantity = 8 // 5 (initial) + 3 (from listing)

      mockEntityManager.findOne.mockResolvedValueOnce({ ...mockListing }) // Listing
      mockEntityManager.findOne.mockResolvedValueOnce({ ...mockInventoryItem }) // Seller's inventory item
      mockEntityManager.save
        .mockResolvedValueOnce(mockUpdatedListing) // Save updated listing
        .mockResolvedValueOnce({ ...mockInventoryItem, quantity: expectedInventoryQuantity }) // Save updated inventory

      const result = await service.cancelMarketListing(listingId, sellerId)

      expect(result).toEqual(mockUpdatedListing)
      expect(mockEntityManager.findOne).toHaveBeenCalledWith(
        MarketListing,
        expect.objectContaining({
          where: { id: listingId, sellerId, listingStatus: ListingStatus.ACTIVE },
          lock: { mode: "for_update" },
        }),
      )
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        MarketListing,
        expect.objectContaining({ listingStatus: ListingStatus.CANCELLED }),
      )
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        InventoryItem,
        expect.objectContaining({ quantity: expectedInventoryQuantity }),
      )
      expect(mockEconomyCacheService.removeItemPrice).toHaveBeenCalledWith(mockListing.itemId)
    })

    it("should throw NotFoundException if active listing not found for seller", async () => {
      mockEntityManager.findOne.mockResolvedValue(null)

      await expect(service.cancelMarketListing("non-existent-listing", "seller-1")).rejects.toThrow(NotFoundException)
    })
  })
})
