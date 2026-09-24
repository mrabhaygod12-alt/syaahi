// Six credentials can be managed for authorised failover. They do not increase
// an organisation/project's quota, and quota errors must cool down the provider.
const cursor = new Map<string, number>();
export function providerKeys(name: string): string[] {
  return Array.from(
    new Set(
      [
        process.env[name],
        ...Array.from({ length: 6 }, (_, i) => process.env[`${name}_${i + 1}`]),
      ]
        .filter((v): v is string => !!v?.trim())
        .map((v) => v.trim()),
    ),
  ).slice(0, 6);
}
export function orderedKeys(name: string): string[] {
  const keys = providerKeys(name);
  if (!keys.length) return [];
  const index = (cursor.get(name) || 0) % keys.length;
  cursor.set(name, index + 1);
  return [...keys.slice(index), ...keys.slice(0, index)];
}
