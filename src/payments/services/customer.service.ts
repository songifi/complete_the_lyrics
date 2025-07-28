import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Customer } from '../entities/customer.entity';
import { StripeService } from './stripe.service';
import { CreateCustomerDto } from '../dto/create-customer.dto';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly stripeService: StripeService,
  ) {}

  async create(dto: CreateCustomerDto): Promise<Customer> {
    try {
      // Create Stripe customer first
      const stripeCustomer = await this.stripeService.createCustomer(dto);

      // Create local customer record
      const customer = this.customerRepository.create({
        userId: dto.userId,
        stripeCustomerId: stripeCustomer.id,
        metadata: dto.metadata,
        isActive: true,
      });

      const savedCustomer = await this.customerRepository.save(customer);

      this.logger.log(
        `Customer created: ${savedCustomer.id} for user: ${dto.userId}`,
      );
      return savedCustomer;
    } catch (error) {
      this.logger.error(`Failed to create customer: ${error.message}`);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<Customer | null> {
    return this.customerRepository.findOne({
      where: { userId },
      relations: ['transactions', 'subscriptions'],
    });
  }

  async findById(id: string): Promise<Customer | null> {
    return this.customerRepository.findOne({
      where: { id },
      relations: ['transactions', 'subscriptions'],
    });
  }

  async findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<Customer | null> {
    return this.customerRepository.findOne({
      where: { stripeCustomerId },
      relations: ['transactions', 'subscriptions'],
    });
  }

  async updateMetadata(
    id: string,
    metadata: Record<string, any>,
  ): Promise<Customer> {
    const customer = await this.findById(id);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    customer.metadata = { ...customer.metadata, ...metadata };
    return this.customerRepository.save(customer);
  }

  async deactivate(id: string): Promise<Customer> {
    const customer = await this.findById(id);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    customer.isActive = false;
    return this.customerRepository.save(customer);
  }

  async reactivate(id: string): Promise<Customer> {
    const customer = await this.findById(id);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    customer.isActive = true;
    return this.customerRepository.save(customer);
  }
}
