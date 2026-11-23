import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { API_BASE_URL } from '../api.config';
import { ChatMessage, ChatRequest, ChatResponse } from '../models/assistant.model';
import { AuthService } from './auth.service';

const MAX_LENGTH = 1000;        // the same limit the API checks
const HISTORY_SENT = 20;        // the API keeps only the last 20 messages anyway

// The shopping assistant chat. One copy for the whole app, so the conversation
// stays put while the customer moves between pages.
@Injectable({ providedIn: 'root' })
export class AssistantService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private apiUrl = `${API_BASE_URL}/assistant/chat`;

  readonly maxLength = MAX_LENGTH;
  readonly messages = signal<ChatMessage[]>([]);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);

  private customerId = computed(() => this.auth.customer()?.id ?? null);

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
    this.sending.set(true);

    const request: ChatRequest = { messages: this.messages().slice(-HISTORY_SENT) };
    this.http.post<ChatResponse>(this.apiUrl, request).subscribe({
      next: response => {
        this.messages.update(list => [...list, { role: 'assistant', text: response.reply }]);
        this.sending.set(false);
      },
      error: (err: HttpErrorResponse) => {
        // Take the question back out, so a retry doesn't send it twice
        this.messages.update(list => list.slice(0, -1));
        this.error.set(describe(err));
        this.sending.set(false);
      }
    });
  }

  clear(): void {
    this.messages.set([]);
    this.error.set(null);
  }
}

function describe(err: HttpErrorResponse): string {
  if (err.status === 0) return 'Could not reach Kiyaara. Check your connection and try again.';
  if (err.status === 401) return 'Your login has ended. Please log in again to chat.';
  if (err.status === 429) return err.error?.error ?? 'You are sending messages quickly. Wait a moment and try again.';
  if (err.status === 400) return 'That message could not be sent. Try a shorter one.';
  return 'The assistant is not available right now. Please try again in a little while.';
}
