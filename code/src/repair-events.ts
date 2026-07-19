import type { RepairEvent, RepairRun } from "./repair";

type EventSubscriber = (event: string) => void;

export class RepairEventStore {
  // Keep prior updates so a dashboard can reconnect without missing progress
  private readonly eventsByRun = new Map<string, RepairEvent[]>();
  // Track active SSE listeners for each repair run
  private readonly subscribersByRun = new Map<string, Set<EventSubscriber>>();
  private sequence = 0;

  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  publish(run: RepairRun) {
    // Create one ordered, safe snapshot for the dashboard
    const event: RepairEvent = {
      runId: run.id,
      sequence: this.sequence + 1,
      status: run.status,
      occurredAt: this.now(),
      run: { ...run },
    };
    this.sequence = event.sequence;

    const history = this.eventsByRun.get(run.id) ?? [];
    history.push(event);
    this.eventsByRun.set(run.id, history);

    const serializedEvent = JSON.stringify(event);
    // Send the new update to every browser already watching this run
    this.subscribersByRun.get(run.id)?.forEach((subscriber) => subscriber(serializedEvent));
  }

  subscribe(runId: string, subscriber: EventSubscriber) {
    const subscribers = this.subscribersByRun.get(runId) ?? new Set<EventSubscriber>();
    subscribers.add(subscriber);
    this.subscribersByRun.set(runId, subscribers);

    // Replay past updates before waiting for future ones.
    this.eventsByRun.get(runId)?.forEach((event) => subscriber(JSON.stringify(event)));

    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) {
        this.subscribersByRun.delete(runId);
      }
    };
  }
}
