import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProductCard } from '../../models/assistant.model';
import { ChatProductCardsComponent } from './chat-product-cards.component';

const kurta: ProductCard = {
  id: 1, name: 'Block Print Cotton Kurta Set', brand: 'Neel Loom', imageUrl: '/images/products/kurta-set.webp',
  price: 1499, mrp: 2999, rating: 4.4, inStock: true
};
const shirt: ProductCard = {
  id: 3, name: 'Linen Shirt', brand: 'Coastline', imageUrl: '', price: 1799, mrp: 1799, rating: 0, inStock: false
};

function render(products: ProductCard[]): HTMLElement {
  TestBed.configureTestingModule({ imports: [ChatProductCardsComponent], providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(ChatProductCardsComponent);
  fixture.componentRef.setInput('products', products);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ChatProductCardsComponent', () => {
  it('draws one card per product, linking to its page', () => {
    const cards = render([kurta, shirt]).querySelectorAll<HTMLAnchorElement>('a.card');

    expect(cards.length).toBe(2);
    expect(cards[0].getAttribute('href')).toBe('/product/1');
    expect(cards[1].getAttribute('href')).toBe('/product/3');
  });

  it('shows the price, the MRP and the discount', () => {
    const card = render([kurta]).querySelector('a.card')!;

    expect(card.querySelector('.price strong')!.textContent).toContain('₹1,499');
    expect(card.querySelector('.price s')!.textContent).toContain('₹2,999');
    expect(card.querySelector('.tag')!.textContent).toContain('50% off');
    expect(card.getAttribute('aria-label')).toBe('Neel Loom Block Print Cotton Kurta Set, ₹1,499, 50% off ₹2,999');
  });

  it('marks sold-out products and leaves out a crossed-out price when there is no discount', () => {
    const card = render([shirt]).querySelector('a.card')!;

    expect(card.querySelector('.tag')!.textContent).toContain('Sold out');
    expect(card.querySelector('.price s')).toBeNull();
    expect(card.querySelector('.rating')).toBeNull();
    expect(card.getAttribute('aria-label')).toContain('sold out');
  });

  it('uses a placeholder photo when a product has none', () => {
    const img = render([shirt]).querySelector('img')!;

    expect(img.getAttribute('src')).toContain('placehold.co');
  });
});
