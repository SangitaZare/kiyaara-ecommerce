import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '../api.config';
import { Product } from '../models/product.model';
import { CartService } from './cart.service';
import { StoreService } from './store.service';

const product = (price: number): Product => ({
  id: 1, name: 'Kurta', brand: 'Neel Loom', category: 'Kurtas', gender: 'Women', description: '',
  imageUrl: '', price, mrp: price, stock: 5, sizes: ['M'], rating: 0, ratingCount: 0, createdAt: ''
});

describe('StoreService and the bag', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function cartWith(price: number): CartService {
    const cart = TestBed.inject(CartService);
    cart.items.set([{ product: product(price), size: 'M', quantity: 1 }]);
    return cart;
  }

  it('uses the delivery rule the API sends', () => {
    const store = TestBed.inject(StoreService);
    http.expectOne(`${API_BASE_URL}/store/delivery`).flush({ freeFrom: 1499, fee: 99 });

    expect(store.freeDeliveryFrom()).toBe(1499);
    const cart = cartWith(1200);
    expect(cart.deliveryFee()).toBe(99);
    expect(cart.amountForFreeDelivery()).toBe(299);
    expect(cart.total()).toBe(1299);
  });

  it('keeps the starting rule when the API cannot be reached', () => {
    const store = TestBed.inject(StoreService);
    http.expectOne(`${API_BASE_URL}/store/delivery`).error(new ProgressEvent('error'));

    expect(store.freeDeliveryFrom()).toBe(999);
    expect(cartWith(500).deliveryFee()).toBe(79);
    expect(cartWith(999).deliveryFee()).toBe(0);
  });
});
