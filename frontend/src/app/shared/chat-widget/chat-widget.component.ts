import { Component, ElementRef, afterRenderEffect, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AssistantService } from '../../services/assistant.service';
import { AuthService } from '../../services/auth.service';
import { ProductCard } from '../../models/assistant.model';
import { Block, parseChatMarkdown } from './chat-markdown';
import { ChatProductCardsComponent } from './chat-product-cards.component';

// Ready-made questions for an empty chat, so customers see what the assistant can do
const SUGGESTIONS = [
  'Cotton kurta sets under ₹2,000',
  'Where is my latest order?',
  'Gift ideas for a wedding',
  'Men’s shirts in size L'
];

const EXPANDED_KEY = 'kiyaara-chat-expanded';

function readExpanded(): boolean {
  try {
    return localStorage.getItem(EXPANDED_KEY) === 'true';
  } catch {
    return false;
  }
}

interface ThreadItem {
  role: 'user' | 'assistant';
  text: string;
  blocks: Block[];
  products?: ProductCard[];
  streaming?: boolean;
}

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [RouterLink, MatIconModule, ChatProductCardsComponent],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    @if (!open()) {
      <button type="button" class="launcher" (click)="show()" aria-label="Open the shopping assistant">
        <mat-icon>chat</mat-icon>
        <span>Ask Kiyaara</span>
      </button>
    } @else {
      <section class="panel" [class.expanded]="expanded()" role="dialog" aria-label="Kiyaara shopping assistant">
        <header>
          <div class="title">
            <span class="badge"><mat-icon>auto_awesome</mat-icon></span>
            <div>
              <strong>Kiyaara Assistant</strong>
              <span>Finds products and checks your orders</span>
            </div>
          </div>
          @if (thread().length) {
            <button type="button" class="icon-button" (click)="chat.clear()" title="Start a new chat" aria-label="Start a new chat">
              <mat-icon>restart_alt</mat-icon>
            </button>
          }
          <button type="button" class="icon-button size-toggle" (click)="toggleSize()"
                  [title]="expanded() ? 'Make smaller' : 'Make bigger'"
                  [attr.aria-label]="expanded() ? 'Make the assistant smaller' : 'Make the assistant bigger'"
                  [attr.aria-pressed]="expanded()">
            <mat-icon>{{ expanded() ? 'close_fullscreen' : 'open_in_full' }}</mat-icon>
          </button>
          <button type="button" class="icon-button" (click)="close()" aria-label="Close the assistant">
            <mat-icon>close</mat-icon>
          </button>
        </header>

        <div class="body" #body aria-live="polite">
          @if (!auth.isLoggedIn()) {
            <div class="intro">
              <p>Log in to chat with the Kiyaara assistant. It can find products for you and tell you where your orders are.</p>
              <a class="primary" routerLink="/login" [queryParams]="{ returnUrl: router.url }" (click)="close()">Log in</a>
            </div>
          } @else {
            @if (!thread().length) {
              <div class="intro">
                <p>Hi {{ auth.firstName() }}! Ask me about products, sizes and prices, or about your orders.</p>
                <div class="chips">
                  @for (s of suggestions; track s) {
                    <button type="button" (click)="ask(s)" [disabled]="chat.sending()">{{ s }}</button>
                  }
                </div>
              </div>
            }

            @for (m of thread(); track $index) {
              <div class="msg" [class.user]="m.role === 'user'" [class.streaming]="m.streaming" [class.empty]="!m.text">
                @if (m.role === 'user') {
                  <p>{{ m.text }}</p>
                } @else {
                  @for (block of m.blocks; track $index) {
                    @if (block.kind === 'paragraph') {
                      <p>
                        @for (part of block.parts; track $index) {
                          @switch (part.kind) {
                            @case ('bold') { <strong>{{ part.text }}</strong> }
                            @case ('link') { <a [routerLink]="part.path" (click)="followedLink()">{{ part.text }}</a> }
                            @default { {{ part.text }} }
                          }
                        }
                      </p>
                    } @else {
                      <ul [class.ordered]="block.ordered">
                        @for (item of block.items; track $index) {
                          <li>
                            @for (part of item; track $index) {
                              @switch (part.kind) {
                                @case ('bold') { <strong>{{ part.text }}</strong> }
                                @case ('link') { <a [routerLink]="part.path" (click)="followedLink()">{{ part.text }}</a> }
                                @default { {{ part.text }} }
                              }
                            }
                          </li>
                        }
                      </ul>
                    }
                  }
                }
              </div>
              @if (m.products?.length) {
                <app-chat-product-cards [products]="m.products!" (opened)="followedLink()" />
              }
            }

            <!-- Dots until the first words arrive; a status line while the assistant looks things up -->
            @if (waiting()) {
              <div class="msg typing" aria-label="The assistant is typing"><span></span><span></span><span></span></div>
            }
            @if (chat.status(); as status) {
              <div class="status" role="status">{{ status }}</div>
            }

            @if (chat.error(); as error) {
              <div class="error" role="alert">
                <mat-icon>error_outline</mat-icon>
                <span>{{ error }}</span>
              </div>
            }
          }
        </div>

        @if (auth.isLoggedIn()) {
          <form (submit)="submit($event)">
            <textarea #input rows="1" [value]="draft()" (input)="draft.set(input.value)"
                      (keydown.enter)="enter($any($event))" [attr.maxlength]="chat.maxLength"
                      placeholder="Ask about products or orders" aria-label="Your message"></textarea>
            <button type="submit" class="send" [disabled]="!draft().trim() || chat.sending()" aria-label="Send">
              <mat-icon>send</mat-icon>
            </button>
          </form>
          @if (draft().length > chat.maxLength - 100) {
            <div class="count">{{ draft().length }} / {{ chat.maxLength }}</div>
          }
          <div class="note">AI answers can be wrong. Check the product page before you buy.</div>
        }
      </section>
    }
  `,
  styleUrl: './chat-widget.component.css'
})
export class ChatWidgetComponent {
  protected chat = inject(AssistantService);
  protected auth = inject(AuthService);
  protected router = inject(Router);

  protected readonly suggestions = SUGGESTIONS;
  protected open = signal(false);
  protected draft = signal('');

  // Big panel or small one. Remembered in this browser, so the chat reopens the way it was left.
  protected expanded = signal(readExpanded());

  private body = viewChild<ElementRef<HTMLElement>>('body');
  private input = viewChild<ElementRef<HTMLTextAreaElement>>('input');

  // Replies are read once into blocks, not again on every change detection
  protected thread = computed<ThreadItem[]>(() =>
    this.chat.messages().map(m => ({
      ...m,
      blocks: m.role === 'assistant' ? parseChatMarkdown(m.text) : []
    }))
  );

  // True from sending until the first words of the reply arrive
  protected waiting = computed(() => {
    const last = this.chat.messages().at(-1);
    return this.chat.sending() && !last?.text;
  });

  constructor() {
    // Keep the newest message in view
    afterRenderEffect(() => {
      this.thread();
      this.chat.sending();
      this.chat.status();
      this.chat.error();
      const el = this.body()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  show(): void {
    this.open.set(true);
    setTimeout(() => this.input()?.nativeElement.focus());
  }

  close(): void {
    this.open.set(false);
  }

  toggleSize(): void {
    this.expanded.update(value => !value);
    try {
      localStorage.setItem(EXPANDED_KEY, String(this.expanded()));
    } catch {
      // Storage blocked (private window): the size just isn't remembered
    }
    this.input()?.nativeElement.focus();
  }

  ask(text: string): void {
    this.chat.send(text);
    this.draft.set('');
    this.input()?.nativeElement.focus();
  }

  submit(event: Event): void {
    event.preventDefault();
    this.ask(this.draft());
  }

  // Enter sends; Shift+Enter starts a new line
  enter(event: KeyboardEvent): void {
    if (event.shiftKey || event.isComposing) return;
    event.preventDefault();
    this.ask(this.draft());
  }

  // On a phone the panel covers the page, so step aside to show the product
  followedLink(): void {
    if (window.matchMedia('(max-width: 600px)').matches) this.close();
  }
}
