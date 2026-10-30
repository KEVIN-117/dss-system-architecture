import { fakerES as faker } from '@faker-js/faker';
import type { WeightedItem } from '../types/index.js';

/**
 * Inicializa la semilla de Faker para garantizar reproducibilidad matemática.
 */
export function initializeFaker(seedValue = 12345): void {
  faker.seed(seedValue);
}

/**
 * Muestreador de distribución acumulada discreta (Discrete Cumulative Distribution Function - CDF).
 * Garantiza reproducibilidad determinista basada en el generador de números pseudoaleatorios de Faker.
 */
export function sampleWeighted<T>(items: WeightedItem<T>[]): T {
  if (!items || items.length === 0) {
    throw new Error('sampleWeighted error: items array cannot be empty');
  }

  if (items.length === 1) {
    return items[0].item;
  }

  const totalWeight = items.reduce((sum, current) => sum + current.weight, 0);
  if (totalWeight <= 0) {
    return items[0].item;
  }

  const randomThreshold = faker.number.float({ min: 0, max: totalWeight });

  let accumulated = 0;
  for (const entry of items) {
    accumulated += entry.weight;
    if (randomThreshold <= accumulated) {
      return entry.item;
    }
  }

  return items[items.length - 1].item;
}

/**
 * Muestrea un elemento aleatorio uniforme de un arreglo no vacío.
 */
export function sampleUniform<T>(items: T[]): T {
  if (!items || items.length === 0) {
    throw new Error('sampleUniform error: items array cannot be empty');
  }
  const index = faker.number.int({ min: 0, max: items.length - 1 });
  return items[index];
}

/**
 * Genera un número entero determinista en rango [min, max]
 */
export function randomInt(min: number, max: number): number {
  return faker.number.int({ min, max });
}

/**
 * Genera un número decimal flotante determinista en rango [min, max]
 */
export function randomFloat(min: number, max: number, precision = 2): number {
  return Number(faker.number.float({ min, max }).toFixed(precision));
}

/**
 * Retorna true con una probabilidad dada en [0, 1]
 */
export function chance(probability: number): boolean {
  if (probability <= 0) return false;
  if (probability >= 1) return true;
  return faker.number.float({ min: 0, max: 1 }) < probability;
}
