import { TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssistantService } from './assistant.service';
import { API_BASE_URL } from '../api.config';

const STREAM_URL = `${API_BASE_URL}/assistant/chat/stream`;
const event = (data: object) => `data: ${JSON.stringify(data)}\n\n`;

describe('AssistantService (streaming)', () => {
  let service: AssistantService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AssistantService);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();                      // let the "new customer, new chat" effect run first
  });

  afterEach(() => http.verify());

  // The browser hands over everything received so far, each time a bit more arrives
  function arrive(req: TestRequest, ...pieces: string[]): string {
    let text = '';
    for (const piece of pieces) {
      text += piece;
      req.event({ type: HttpEventType.DownloadProgress, loaded: text.length, partialText: text });
    }
    return text;
  }

  function lastMessage() {
    return service.messages().at(-1)!;
  }

  it('sends the conversation as text and asks for a stream', () => {
    service.send('Any sarees?');

    const req = http.expectOne(STREAM_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.responseType).toBe('text');
    expect(req.request.body).toEqual({ messages: [{ role: 'user', text: 'Any sarees?' }] });
    req.flush('');
  });

  it('shows the status, then grows the reply word by word, then adds the cards', () => {
    service.send('Any sarees?');
    const req = http.expectOne(STREAM_URL);

    arrive(req, event({ type: 'status', text: 'Searching the catalogue…' }));
    expect(service.status()).toBe('Searching the catalogue…');
    expect(lastMessage()).toEqual({ role: 'assistant', text: '', streaming: true });

    const soFar = arrive(req,
      event({ type: 'status', text: 'Searching the catalogue…' }),
      event({ type: 'delta', text: 'Try the ' }));
    expect(service.status()).toBeNull();
    expect(lastMessage().text).toBe('Try the ');

    // An event split across two pieces is only handled once it is complete
    const card = { id: 2, name: 'Saree', brand: 'Kesar Lane', imageUrl: '', price: 3299, mrp: 6599, rating: 4.6, inStock: true };
    const done = event({ type: 'done', reply: 'Try the [Saree](/product/2).', products: [card] });
    let text = soFar + event({ type: 'delta', text: '[Saree](/product/2).' }) + done.slice(0, 20);
    req.event({ type: HttpEventType.DownloadProgress, loaded: text.length, partialText: text });
    expect(lastMessage().text).toBe('Try the [Saree](/product/2).');
    expect(service.sending()).toBe(true);

    text += done.slice(20);
    req.event({ type: HttpEventType.DownloadProgress, loaded: text.length, partialText: text });
    expect(lastMessage()).toEqual({
      role: 'assistant', text: 'Try the [Saree](/product/2).', products: [card], streaming: false
    });
    expect(service.sending()).toBe(false);
  });

  it('removes the question and the half-written reply when the stream reports an error', () => {
    service.send('Hi');
    const req = http.expectOne(STREAM_URL);

    arrive(req, event({ type: 'delta', text: 'Hel' }) + event({ type: 'error', message: 'Not available right now.' }));

    expect(service.messages()).toEqual([]);
    expect(service.error()).toBe('Not available right now.');
    expect(service.sending()).toBe(false);
  });

  it('treats a stream that ends without "done" as a failure', () => {
    service.send('Hi');
    const req = http.expectOne(STREAM_URL);

    req.flush(event({ type: 'delta', text: 'Hel' }));

    expect(service.messages()).toEqual([]);
    expect(service.error()).toContain('stopped part way');
  });

  it('shows the rate-limit message from the API', () => {
    service.send('Hi');
    http.expectOne(STREAM_URL).flush(JSON.stringify({ error: 'Too many requests. Please try again in 42 seconds.' }),
      { status: 429, statusText: 'Too Many Requests' });

    expect(service.error()).toBe('Too many requests. Please try again in 42 seconds.');
    expect(service.sending()).toBe(false);
  });

  it('ignores a second question while an answer is still arriving', () => {
    service.send('First');
    service.send('Second');

    http.expectOne(STREAM_URL).flush(event({ type: 'done', reply: 'Answer', products: [] }));
    expect(service.messages().map(m => m.text)).toEqual(['First', 'Answer']);
  });

  it('stops an answer that is still arriving when the chat is cleared', () => {
    service.send('Hi');
    const req = http.expectOne(STREAM_URL);

    service.clear();

    expect(req.cancelled).toBe(true);
    expect(service.messages()).toEqual([]);
    expect(service.sending()).toBe(false);
  });
});
