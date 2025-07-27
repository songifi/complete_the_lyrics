import { Controller, Get, Post, Param, Query, HttpCode, HttpStatus, Delete } from "@nestjs/common"
import type { MarketplaceService } from "../services/marketplace.service"
import type { CreateVirtualItemDto } from "../dto/create-item.dto"
import type { CreateMarketListingDto } from "../dto/create-listing.dto"
import type { BuyItemDto } from "../dto/buy-item.dto"

@Controller("economy/marketplace")
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Post("items")
  @HttpCode(HttpStatus.CREATED)
  createVirtualItem(createItemDto: CreateVirtualItemDto) {
    return this.marketplaceService.createVirtualItem(createItemDto)
  }

  @Get("items/:itemId")
  getVirtualItem(@Param("itemId") itemId: string) {
    return this.marketplaceService.getVirtualItem(itemId)
  }

  @Get("items/:itemId/price")
  getMarketPrice(@Param("itemId") itemId: string) {
    return this.marketplaceService.getMarketPrice(itemId)
  }

  @Post("listings")
  @HttpCode(HttpStatus.CREATED)
  createListing(createListingDto: CreateMarketListingDto) {
    return this.marketplaceService.createMarketListing(createListingDto)
  }

  @Get("listings")
  getActiveListings(@Query("itemId") itemId?: string) {
    return this.marketplaceService.getActiveMarketListings(itemId)
  }

  @Post("buy")
  buyItem(buyItemDto: BuyItemDto, buyerId: string) {
    // Assuming buyerId comes from authentication context, not body in real app
    return this.marketplaceService.buyItem(buyerId, buyItemDto)
  }

  @Delete("listings/:listingId/cancel")
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelListing(@Param("listingId") listingId: string, sellerId: string) {
    // Assuming sellerId comes from authentication context
    return this.marketplaceService.cancelMarketListing(listingId, sellerId)
  }

  @Get("inventory/:userId")
  getUserInventory(@Param("userId") userId: string) {
    return this.marketplaceService.getUserInventory(userId)
  }
}
