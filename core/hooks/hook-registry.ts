import type { ContentEvents } from '../content/content-events.ts';
import type { EventEmitter, EventHandler } from '../events/event-bus.ts';

export type HookEventName = keyof ContentEvents;
export type HookHandler<TEventName extends HookEventName> = EventHandler<ContentEvents[TEventName]>;

export class HookRegistry {
  readonly #eventBus: EventEmitter<ContentEvents>;

  constructor(eventBus: EventEmitter<ContentEvents>) {
    this.#eventBus = eventBus;
  }

  on<TEventName extends HookEventName>(eventName: TEventName, handler: HookHandler<TEventName>): () => void {
    return this.#eventBus.on(eventName, handler);
  }

  off<TEventName extends HookEventName>(eventName: TEventName, handler: HookHandler<TEventName>): void {
    this.#eventBus.off(eventName, handler);
  }
}
