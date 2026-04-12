import { db } from './index';
import type { CostType, MeterType } from './schema';

const defaultCostTypes: Omit<CostType, 'id'>[] = [
  { name: 'Grundsteuer', distribution: 'area', category: 'tax', sortOrder: 1 },
  { name: 'Wasser', distribution: 'persons', category: 'water', sortOrder: 2 },
  { name: 'Abwasser', distribution: 'persons', category: 'water', sortOrder: 3 },
  { name: 'Heizung/Warmwasser', distribution: 'messdienst', category: 'heating', sortOrder: 4 },
  { name: 'Straßenreinigung', distribution: 'area', category: 'cleaning', sortOrder: 5 },
  { name: 'Müllabfuhr (Bio)', distribution: 'persons', category: 'cleaning', sortOrder: 6 },
  { name: 'Müllabfuhr (Rest)', distribution: 'persons', category: 'cleaning', sortOrder: 7 },
  { name: 'Hausreinigung', distribution: 'area', category: 'cleaning', sortOrder: 8 },
  { name: 'Gartenpflege', distribution: 'area', category: 'cleaning', sortOrder: 9 },
  { name: 'Allgemeinstrom', distribution: 'units', category: 'misc', sortOrder: 10 },
  { name: 'Schornsteinfeger', distribution: 'units', category: 'misc', sortOrder: 11 },
  { name: 'Feuerversicherung', distribution: 'area', category: 'insurance', sortOrder: 12 },
  { name: 'Sturm/Glas/Wasser', distribution: 'area', category: 'insurance', sortOrder: 13 },
  { name: 'Haftpflicht', distribution: 'area', category: 'insurance', sortOrder: 14 },
  { name: 'Hauswart', distribution: 'area', category: 'misc', sortOrder: 15 },
  { name: 'Kabelanschluss', distribution: 'units', category: 'misc', sortOrder: 16 },
  { name: 'Wascheinrichtung', distribution: 'units', category: 'misc', sortOrder: 17 },
  { name: 'Sonstige', distribution: 'units', category: 'misc', sortOrder: 18 },
];

const defaultMeterTypes: Omit<MeterType, 'id'>[] = [
  { name: 'Kaltwasser', unit: 'm³', category: 'water' },
  { name: 'Warmwasser', unit: 'm³', category: 'water' },
  { name: 'Strom', unit: 'kWh', category: 'energy' },
  { name: 'Gas', unit: 'm³', category: 'energy' },
  { name: 'Heizung', unit: 'kWh', category: 'energy' },
];

export async function seedDatabase(): Promise<void> {
  const costTypeCount = await db.costTypes.count();
  if (costTypeCount === 0) {
    await db.costTypes.bulkAdd(defaultCostTypes);
  }

  const meterTypeCount = await db.meterTypes.count();
  if (meterTypeCount === 0) {
    await db.meterTypes.bulkAdd(defaultMeterTypes);
  }

  const messdienstSetting = await db.settings.get('messdienstName');
  if (!messdienstSetting) {
    await db.settings.put({ key: 'messdienstName', value: 'Messdienstleister' });
  }

  const landlordSetting = await db.settings.get('landlord');
  if (!landlordSetting) {
    await db.settings.put({
      key: 'landlord',
      value: { name: '', address: '', iban: '', taxId: '' },
    });
  }
}
