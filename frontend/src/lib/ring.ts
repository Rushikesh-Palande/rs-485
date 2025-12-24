export class RingBuffer<T> {
  private arr: T[];
  private idx = 0;
  private len = 0;

  constructor(private capacity: number) {
    this.arr = new Array<T>(capacity);
  }

  push(v: T) {
    this.arr[this.idx] = v;
    this.idx = (this.idx + 1) % this.capacity;
    this.len = Math.min(this.capacity, this.len + 1);
  }

  toArray(): T[] {
    const out: T[] = [];
    for (let i = 0; i < this.len; i++) {
      const pos = (this.idx - this.len + i + this.capacity) % this.capacity;
      out.push(this.arr[pos]);
    }
    return out;
  }

  size(): number {
    return this.len;
  }

  clear() {
    this.idx = 0;
    this.len = 0;
    this.arr = new Array<T>(this.capacity);
  }
}
