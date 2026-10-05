/**
 * Minimale 6502-assembler voor de PRG-startcode die PixelForge genereert.
 * Ondersteunt de beperkte subset die daar gebruikt wordt:
 *   labels, .byte, :BasicUpstart2, en lda/sta/ldx/ora/inx/bne/jmp.
 * Produceert een .prg: 2-byte load-adres + machinecode.
 */

function parseHex(s: string): number {
  return parseInt(s.trim().replace('$', ''), 16);
}

function parseByteList(operand: string): number[] {
  return operand.split(',').map((s) => parseHex(s));
}

function basicStub(entry: number): number[] {
  const digits = String(entry);
  const end = 0x0801 + 7 + digits.length;
  return [
    end & 0xff, end >> 8,
    0x0a, 0x00,
    0x9e, 0x20,
    ...Array.from(digits, (c) => c.charCodeAt(0)),
    0x00,
    0x00, 0x00,
  ];
}

interface Instr { mnemonic: string; mode: string; operand: string }

function parseInstruction(line: string): Instr {
  const parts = line.trim().split(/\s+/).filter(Boolean);
  const mnemonic = parts[0].toLowerCase();
  const operand = parts.slice(1).join(' ');
  let mode: string;
  if (!operand) mode = 'imp';
  else if (operand.startsWith('#')) mode = 'imm';
  else if (operand.endsWith(', x')) mode = 'absx';
  else if (mnemonic === 'bne') mode = 'rel';
  else mode = 'abs';
  return { mnemonic, mode, operand };
}

const OPCODES: Record<string, Record<string, number>> = {
  lda: { imm: 0xa9, abs: 0xad, absx: 0xbd },
  sta: { abs: 0x8d, absx: 0x9d },
  ldx: { imm: 0xa2 },
  ora: { imm: 0x09 },
  inx: { imp: 0xe8 },
  bne: { rel: 0xd0 },
  jmp: { abs: 0x4c },
};

function instrSize(line: string): number {
  const { mnemonic, mode } = parseInstruction(line);
  const op = OPCODES[mnemonic]?.[mode];
  if (op === undefined) throw new Error(`Unsupported instruction: ${line}`);
  return mode === 'imp' ? 1 : mode === 'imm' || mode === 'rel' ? 2 : 3;
}

function emitInstruction(line: string, labels: Map<string, number>, pc: number): number[] {
  const { mnemonic, mode, operand } = parseInstruction(line);
  const opcode = OPCODES[mnemonic]?.[mode];
  if (opcode === undefined) throw new Error(`Unsupported instruction: ${line}`);
  const out = [opcode];
  if (mode === 'imm') {
    out.push(parseHex(operand.slice(1)));
  } else if (mode === 'abs') {
    const addr = operand.startsWith('$') ? parseHex(operand) : labels.get(operand)!;
    out.push(addr & 0xff, addr >> 8);
  } else if (mode === 'absx') {
    const base = operand.slice(0, -3).trim();
    const addr = base.startsWith('$') ? parseHex(base) : labels.get(base)!;
    out.push(addr & 0xff, addr >> 8);
  } else if (mode === 'rel') {
    const target = labels.get(operand)!;
    out.push((target - (pc + 2)) & 0xff);
  }
  return out;
}

export function assemble6502(src: string): Uint8Array {
  const lines = src.split('\n');
  const labels = new Map<string, number>();

  // Pass 1: label-adressen bepalen.
  let pc = 0x0801;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith(':BasicUpstart2(')) {
      pc = 0x0801;
      labels.set('main', 0x080e);
      pc = 0x080e;
      continue;
    }
    const labelMatch = line.match(/^(\w+):/);
    if (labelMatch) {
      labels.set(labelMatch[1], pc);
      continue;
    }
    if (line.startsWith('.byte')) {
      pc += parseByteList(line.slice(5)).length;
      continue;
    }
    pc += instrSize(line);
  }

  // Pass 2: machinecode uitschrijven.
  const out: number[] = [];
  pc = 0x0801;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith(':BasicUpstart2(')) {
      out.push(...basicStub(labels.get('main')!));
      pc = labels.get('main')!;
      continue;
    }
    if (/^\w+:/.test(line)) continue;
    if (line.startsWith('.byte')) {
      for (const b of parseByteList(line.slice(5))) {
        out.push(b);
        pc++;
      }
      continue;
    }
    const bytes = emitInstruction(line, labels, pc);
    out.push(...bytes);
    pc += bytes.length;
  }

  const prg = new Uint8Array(2 + out.length);
  prg[0] = 0x01;
  prg[1] = 0x08; // load-adres $0801
  prg.set(out, 2);
  return prg;
}
