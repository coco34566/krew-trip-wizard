function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const u16 = (v: number) => new Uint8Array([v & 255, (v >>> 8) & 255]);
const u32 = (v: number) => new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]);
function concat(parts: Uint8Array[]) { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }

export async function createPhotosZip(files: { name: string; url: string }[]) {
  const local: Uint8Array[] = [], central: Uint8Array[] = []; let offset = 0; const enc = new TextEncoder();
  for (const file of files) {
    const response = await fetch(file.url); if (!response.ok) throw new Error(`Téléchargement impossible (${response.status})`);
    const data = new Uint8Array(await response.arrayBuffer()); const name = enc.encode(file.name); const crc = crc32(data);
    const entry = concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]);
    local.push(entry);
    central.push(concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += entry.length;
  }
  const cd = concat(central);
  return new Blob([concat([...local, cd, u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(offset), u16(0)])], { type: "application/zip" });
}
