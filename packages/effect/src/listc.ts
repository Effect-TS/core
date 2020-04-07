/* istanbul ignore file */

export class LinkedListNode<T> {
  constructor(public value: T | null, public next: LinkedListNode<T> | null = null) {}
}

export class LinkedList<T> {
  constructor(
    public head: LinkedListNode<T> | null = null,
    public tail: LinkedListNode<T> | null = null
  ) {
    this.head = null;
    this.tail = null;
  }

  empty() {
    return this.head === null;
  }

  prepend(value: T) {
    const newNode = new LinkedListNode<T>(value, this.head);
    this.head = newNode;
    if (!this.tail) {
      this.tail = newNode;
    }
    return this;
  }

  append(value: T) {
    const newNode = new LinkedListNode(value);
    if (!this.head) {
      this.head = newNode;
      this.tail = newNode;

      return this;
    }
    this.tail!.next = newNode;
    this.tail = newNode;
    return this;
  }

  deleteHead() {
    if (!this.head) {
      return null;
    }
    const deletedHead = this.head;
    if (this.head.next) {
      this.head = this.head.next;
    } else {
      this.head = null;
      this.tail = null;
    }
    return deletedHead;
  }
}

export class DoublyLinkedListNode<T> {
  constructor(
    public value: T | null,
    public next: DoublyLinkedListNode<T> | null = null,
    public previous: DoublyLinkedListNode<T> | null = null
  ) {}
}

export class DoublyLinkedList<T> {
  constructor(
    public head: DoublyLinkedListNode<T> | null = null,
    public tail: DoublyLinkedListNode<T> | null = null
  ) {}

  prepend(value: T) {
    const newNode = new DoublyLinkedListNode(value, this.head);
    if (this.head) {
      this.head.previous = newNode;
    }
    this.head = newNode;
    if (!this.tail) {
      this.tail = newNode;
    }
    return this;
  }

  append(value: T) {
    const newNode = new DoublyLinkedListNode(value);
    if (!this.head) {
      this.head = newNode;
      this.tail = newNode;

      return this;
    }
    this.tail!.next = newNode;
    newNode.previous = this.tail;
    this.tail = newNode;
    return this;
  }

  deleteTail() {
    if (!this.tail) {
      return null;
    }
    if (this.head === this.tail) {
      const deletedTail = this.tail;
      this.head = null;
      this.tail = null;

      return deletedTail;
    }
    const deletedTail = this.tail;
    this.tail = this.tail.previous;
    this.tail!.next = null;
    return deletedTail;
  }

  deleteHead() {
    if (!this.head) {
      return null;
    }
    const deletedHead = this.head;
    if (this.head.next) {
      this.head = this.head.next;
      this.head.previous = null;
    } else {
      this.head = null;
      this.tail = null;
    }
    return deletedHead;
  }

  empty() {
    return this.head === null;
  }
}
