/** Reject duplicate object members before JSON.parse discards them. */

export class JsonMemberError extends Error {
  readonly code: "DUPLICATE_MEMBER" | "MALFORMED_JSON";

  constructor(code: "DUPLICATE_MEMBER" | "MALFORMED_JSON") {
    super(code);
    this.name = "JsonMemberError";
    this.code = code;
  }
}

export function assertUniqueJsonMembers(text: string): void {
  const scanner = new Scanner(text);
  scanner.parseValue();
  scanner.skipWhitespace();
  if (!scanner.done()) throw new JsonMemberError("MALFORMED_JSON");
}

class Scanner {
  private index = 0;

  constructor(private readonly text: string) {}

  done(): boolean {
    return this.index >= this.text.length;
  }

  parseValue(): void {
    this.skipWhitespace();
    const char = this.peek();
    if (char === "{") this.parseObject();
    else if (char === "[") this.parseArray();
    else if (char === '"') this.parseString();
    else if (char === "-" || (char >= "0" && char <= "9")) this.parseNumber();
    else if (this.text.startsWith("true", this.index)) this.index += 4;
    else if (this.text.startsWith("false", this.index)) this.index += 5;
    else if (this.text.startsWith("null", this.index)) this.index += 4;
    else throw new JsonMemberError("MALFORMED_JSON");
  }

  skipWhitespace(): void {
    while (this.index < this.text.length && " \n\r\t".includes(this.text[this.index]!)) this.index += 1;
  }

  private parseObject(): void {
    this.expect("{");
    const members = new Set<string>();
    this.skipWhitespace();
    if (this.peek() === "}") {
      this.index += 1;
      return;
    }
    while (this.index < this.text.length) {
      this.skipWhitespace();
      const key = this.parseString();
      if (members.has(key)) throw new JsonMemberError("DUPLICATE_MEMBER");
      members.add(key);
      this.skipWhitespace();
      this.expect(":");
      this.parseValue();
      this.skipWhitespace();
      if (this.peek() === ",") {
        this.index += 1;
        continue;
      }
      this.expect("}");
      return;
    }
    throw new JsonMemberError("MALFORMED_JSON");
  }

  private parseArray(): void {
    this.expect("[");
    this.skipWhitespace();
    if (this.peek() === "]") {
      this.index += 1;
      return;
    }
    while (this.index < this.text.length) {
      this.parseValue();
      this.skipWhitespace();
      if (this.peek() === ",") {
        this.index += 1;
        continue;
      }
      this.expect("]");
      return;
    }
    throw new JsonMemberError("MALFORMED_JSON");
  }

  private parseString(): string {
    this.expect('"');
    let value = "";
    while (this.index < this.text.length) {
      const char = this.text[this.index]!;
      if (char === '"') {
        this.index += 1;
        return value;
      }
      if (char === "\\") {
        const escaped = this.text[this.index + 1];
        if (escaped === undefined) throw new JsonMemberError("MALFORMED_JSON");
        this.index += 2;
        if (escaped === "u") {
          const hex = this.text.slice(this.index, this.index + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new JsonMemberError("MALFORMED_JSON");
          value += String.fromCharCode(Number.parseInt(hex, 16));
          this.index += 4;
          continue;
        }
        const simple: Record<string, string> = {
          '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t",
        };
        if (!(escaped in simple)) throw new JsonMemberError("MALFORMED_JSON");
        value += simple[escaped];
        continue;
      }
      if (char < " ") throw new JsonMemberError("MALFORMED_JSON");
      value += char;
      this.index += 1;
    }
    throw new JsonMemberError("MALFORMED_JSON");
  }

  private parseNumber(): void {
    const rest = this.text.slice(this.index);
    const match = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(rest);
    if (!match) throw new JsonMemberError("MALFORMED_JSON");
    this.index += match[0].length;
  }

  private peek(): string {
    if (this.index >= this.text.length) throw new JsonMemberError("MALFORMED_JSON");
    return this.text[this.index]!;
  }

  private expect(char: string): void {
    if (this.peek() !== char) throw new JsonMemberError("MALFORMED_JSON");
    this.index += 1;
  }
}
