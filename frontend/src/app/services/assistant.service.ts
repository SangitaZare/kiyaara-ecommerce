import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { ChatMessage, ChatRequest, ChatStreamEvent } from '../models/assistant.model';
import { AuthService } from './auth.service';

const MAX_LENGTH = 1000;        // the same limit the API checks
const HISTORY_SENT = 20;        // the API keeps only the last 20 messages anyway

// The shopping assistant chat. One copy for the whole app, so the conversation
// stays put while the customer moves between pages.
//
// Answers are streamed: the API sends Server-Sent Events ("data: {json}" + blank line) and the
// reply grows word by word. HttpClient hands over the text received so far on every progress
// event, so the login interceptor still adds the token and handles an expired login.
@Injectable({ providedIn: 'root' })
export class AssistantService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private streamUrl = `${API_BASE_URL}/assistant/chat/stream`;

  readonly maxLength = MAX_LENGTH;
  readonly messages = signal<ChatMessage[]>([]);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);
  readonly status = signal<string | null>(null);       // "Searching the catalogue…" while a tool runs

  private customerId = computed(() => this.auth.customer()?.id ?? null);
  private request?: Subscription;

  constructor() {
    // Logging out or switching accounts starts a fresh chat: one person's orders never show to the next.
    // Only the id is watched, so saving a new name on the profile page keeps the chat.
    effect(() => {
      this.customerId();
      untracked(() => this.clear());
    });
  }

  send(text: string): void {
    const message = text.trim().slice(0, MAX_LENGTH);
    if (!message || this.sending()) return;

    this.error.set(null);
    this.messages.update(list => [...list, { role: 'user', text: message }]);

    // Only the words go back to the API: cards are for showing, and the API reloads products itself
    const request: ChatRequest = {
      messages: this.messages().slice(-HISTORY_SENT).map(({ role, text }) => ({ role, text }))
    };

    // An empty reply that fills in as the answer arrives
    this.messages.update(list => [...list, { role: 'assistant', text: '', streaming: true }]);
    this.sending.set(true);
    this.status.set(null);

    let read = 0;           // how much of the response text has been handled
    this.request = this.http
      .post(this.streamUrl, request, { observe: 'events', reportProgress: true, responseType: 'text' })
      .subscribe({
        next: event => {
          if (event.type === HttpEventType.DownloadProgress && event.partialText) {
            read = this.readEvents(event.partialText, read);
          } else if (event.type === HttpEventType.Response) {
            read = this.readEvents(event.body ?? '', read);
            // The stream ended without "done" or "error": treat it as a failure
            if (this.sending()) this.fail('The answer stopped part way through. Please try again.');
          }
        },
        error: (err: HttpErrorResponse) => this.fail(describe(err))
      });
  }

  // Stops an answer that is still arriving and empties the chat
  clear(): void {
    this.request?.unsubscribe();
    this.request = undefined;
    this.messages.set([]);
    this.error.set(null);
    this.status.set(null);
    this.sending.set(false);
  }

  // Handles every complete event in text[from..] and returns where the unfinished rest starts
  private readEvents(text: string, from: number): number {
    let end: number;
    while (this.sending() && (end = text.indexOf('\n\n', from)) !== -1) {
      const block = text.slice(from, end);
      from = end + 2;

      const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('');
      if (!data) continue;
      try {
        this.handle(JSON.parse(data) as ChatStreamEvent);
      } catch {
        this.fail('The assistant sent something unreadable. Please try again.');
      }
    }
    return from;
  }

  private handle(event: ChatStreamEvent): void {
    switch (event.type) {
      case 'status':
        this.status.set(event.text);
        break;
      case 'delta':
        this.status.set(null);
        this.updateReply(m => ({ ...m, text: m.text + event.text }));
        break;
      case 'done':
        this.updateReply(m => ({ ...m, text: event.reply, products: event.products ?? [], streaming: false }));
        this.finish();
        break;
      case 'error':
        this.fail(event.message);
        break;
    }
  }

  // Changes the reply that is still arriving (always the last message)
  private updateReply(change: (m: ChatMessage) => ChatMessage): void {
    this.messages.update(list => {
      const last = list[list.length - 1];
      return last?.streaming ? [...list.slice(0, -1), change(last)] : list;
    });
  }

  private finish(): void {
    this.sending.set(false);
    this.status.set(null);
    this.request?.unsubscribe();
    this.request = undefined;
  }

  // Takes the question and the half-written reply back out, so a retry doesn't send them twice
  private fail(message: string): void {
    if (!this.sending()) return;
    this.messages.update(list => (list[list.length - 1]?.streaming ? list.slice(0, -2) : list));
    this.error.set(message);
    this.finish();
  }
}

function describe(err: HttpErrorResponse): string {
  if (err.status === 0) return 'Could not reach Kiyaara. Check your connection and try again.';
  if (err.status === 401) return 'Your login has ended. Please log in again to chat.';
  if (err.status === 429) return errorText(err.error) ?? 'You are sending messages quickly. Wait a moment and try again.';
  if (err.status === 400) return 'That message could not be sent. Try a shorter one.';
  if (err.status === 504) return errorText(err.error) ?? 'That took too long to answer. Please try again.';
  return 'The assistant is not available right now. Please try again in a little while.';
}

// The API's { "error": "..." }, which arrives as text because the request asks for text
function errorText(body: unknown): string | null {
  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    return typeof parsed?.error === 'string' ? parsed.error : null;
  } catch {
    return null;
  }
}
