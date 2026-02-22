const compareEntries = (left, right) => {
  if (left.availableAtTick !== right.availableAtTick) {
    return left.availableAtTick - right.availableAtTick;
  }

  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  if (left.dependencyOrder !== right.dependencyOrder) {
    return left.dependencyOrder - right.dependencyOrder;
  }

  if (left.sequence !== right.sequence) {
    return left.sequence - right.sequence;
  }

  return left.pluginId.localeCompare(right.pluginId);
};

export class ScheduleQueue {
  constructor() {
    this.entries = [];
    this.sequence = 0;
  }

  enqueue(entry) {
    const queued = Object.freeze({
      ...entry,
      sequence: ++this.sequence
    });

    this.entries.push(queued);
    this.entries.sort(compareEntries);
    return queued;
  }

  removeBySequence(sequence) {
    const index = this.entries.findIndex((entry) => entry.sequence === sequence);
    if (index < 0) {
      return null;
    }

    const [removed] = this.entries.splice(index, 1);
    return removed;
  }

  list() {
    return this.entries.map((entry) => ({ ...entry }));
  }
}
