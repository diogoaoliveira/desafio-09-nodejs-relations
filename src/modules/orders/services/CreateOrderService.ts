import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists || !products) {
      throw new AppError('Customer id does not exists or no product was found');
    }

    const currentProducts = await this.productsRepository.findAllById(products);

    if (!currentProducts.length) {
      throw new AppError('Products not found!');
    }

    const currentProductIds = currentProducts.map(product => product.id);

    const notFoundProducts = products.filter(
      p => !currentProductIds.includes(p.id),
    );

    if (notFoundProducts.length) {
      throw new AppError('Some products are non-existent');
    }

    const productsWithNoQuantity = products.filter(
      p =>
        currentProducts.filter(cp => cp.id === p.id)[0].quantity < p.quantity,
    );

    if (productsWithNoQuantity.length) {
      throw new AppError('Quantity is not available');
    }

    const serializedProducts = products.map(p => ({
      product_id: p.id,
      quantity: p.quantity,
      price: currentProducts.filter(cp => cp.id === p.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializedProducts,
    });

    const orderedProducts = products.map(product => ({
      id: product.id,
      quantity:
        currentProducts.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProducts);

    return order;
  }
}

export default CreateOrderService;
