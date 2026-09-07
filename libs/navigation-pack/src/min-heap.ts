/** Binary min-heap over numeric keys with integer payloads, backed by growable typed arrays. */
export class MinHeap {
  private keys = new Float64Array(1024);
  private values = new Int32Array(1024);
  private size = 0;

  get length(): number {
    return this.size;
  }

  push(key: number, value: number): void {
    if (this.size === this.keys.length) {
      this.grow();
    }
    let index = this.size++;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.keys[parent] <= key) {
        break;
      }
      this.keys[index] = this.keys[parent];
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.keys[index] = key;
    this.values[index] = value;
  }

  peekKey(): number {
    return this.keys[0];
  }

  pop(): number {
    const top = this.values[0];
    this.size--;
    if (this.size > 0) {
      const key = this.keys[this.size];
      const value = this.values[this.size];
      let index = 0;
      for (;;) {
        let child = index * 2 + 1;
        if (child >= this.size) {
          break;
        }
        if (child + 1 < this.size && this.keys[child + 1] < this.keys[child]) {
          child++;
        }
        if (this.keys[child] >= key) {
          break;
        }
        this.keys[index] = this.keys[child];
        this.values[index] = this.values[child];
        index = child;
      }
      this.keys[index] = key;
      this.values[index] = value;
    }
    return top;
  }

  private grow(): void {
    const keys = new Float64Array(this.keys.length * 2);
    keys.set(this.keys);
    this.keys = keys;
    const values = new Int32Array(this.values.length * 2);
    values.set(this.values);
    this.values = values;
  }
}
