// Six credentials can be managed for authorised failover. They do not increase
// an organisation/project's quota, and quota errors must cool down the provider.
const cursor = new Map<string, number>();
export function providerKeys(name: string): string[] {
  const rawList = [
    process.env[name],
    ...Array.from({ length: 10 }, (_, i) => process.env[`${name}_${i + 1}`]),
  ];
  const keys: string[] = [];
  for (const raw of rawList) {
    if (!raw) continue;
    for (const part of raw.split(",")) {
      const trimmed = part.trim();
      if (trimmed && !keys.includes(trimmed)) {
        keys.push(trimmed);
      }
    }
  }
  return keys.slice(0, 10);
}
export function orderedKeys(name: string): string[] {
  const keys = providerKeys(name);
  if (!keys.length) return [];
  const index = (cursor.get(name) || 0) % keys.length;
  cursor.set(name, index + 1);
  return [...keys.slice(index), ...keys.slice(0, index)];
}
