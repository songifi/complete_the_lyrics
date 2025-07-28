import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { CacheModule } from "@nestjs/cache-manager"
import { BullModule } from "@nestjs/bull"
import { VirtualCurrency } from "./entities/virtual-currency.entity"
import { Transaction } from "./entities/transaction.entity"
import { VirtualItem } from "./entities/virtual-item.entity"
import { InventoryItem } from "./entities/inventory-item.entity"
import { MarketListing } from "./entities/market-listing.entity"
import { VirtualCurrencyService } from "./services/virtual-currency.service"
import { MarketplaceService } from "./services/marketplace.service"
import { EconomyCacheService } from "./services/economy-cache.service"
import { TransactionProcessorService } from "./services/transaction-processor.service"
import { VirtualCurrencyController } from "./controllers/virtual-currency.controller"
import { MarketplaceController } from "./controllers/marketplace.controller"

@Module({
  imports: [
    TypeOrmModule.forFeature([VirtualCurrency, Transaction, VirtualItem, InventoryItem, MarketListing]),
    CacheModule.register(), // Configured globally in app.module or here with specific options for Redis
    BullModule.registerQueue({
      name: "economy-transactions",
      // Add Redis connection options here, e.g.:
      // redis: {
      //   host: 'localhost',
      //   port: 6379,
      // },
    }),
  ],
  controllers: [VirtualCurrencyController, MarketplaceController],
  providers: [VirtualCurrencyService, MarketplaceService, EconomyCacheService, TransactionProcessorService],
  exports: [VirtualCurrencyService, MarketplaceService, EconomyCacheService, TransactionProcessorService],
})
export class EconomyModule {}
