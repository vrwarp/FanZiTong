import { isDomainCategory, type DomainCategory } from '@/types';

const DOMAIN_ALIASES: Record<string, DomainCategory> = {
  food: 'food',
  foods: 'food',
  menu: 'food',
  飲食: 'food',
  美食: 'food',
  菜單: 'food',
  church: 'church',
  christian: 'church',
  教會: 'church',
  信仰: 'church',
  slang: 'slang',
  colloquial: 'slang',
  俚語: 'slang',
  口語: 'slang',
  anime: 'anime',
  acgn: 'anime',
  動漫: 'anime',
  動畫: 'anime',
  custom: 'custom',
  other: 'custom',
  自訂: 'custom',
  其他: 'custom',
};

/** Map a free-form domain label to a DomainCategory, or undefined if unknown. */
export function normalizeDomain(value: unknown): DomainCategory | undefined {
  if (typeof value !== 'string') return undefined;
  const key = value.trim().toLowerCase();
  if (!key) return undefined;
  if (isDomainCategory(key)) return key;
  return DOMAIN_ALIASES[key] ?? DOMAIN_ALIASES[value.trim()];
}

/** Split a "|"-delimited list cell (also tolerating ; and full-width separators). */
export function splitList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value !== 'string') return [];
  return value
    .split(/[|;；／/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
