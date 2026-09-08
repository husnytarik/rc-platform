import { describe, expect, it } from 'vitest';
import {
  canTransition,
  isTerminal,
  nextTransitions,
  stockIsReserved,
  type OrderStatus,
} from './order-state';

describe('canTransition', () => {
  it('mutlu yolu ilgili personel yürütür', () => {
    expect(canTransition('placed', 'confirmed', 'sales_staff')).toBe(true);
    expect(canTransition('confirmed', 'in_production', 'production_staff')).toBe(true);
    expect(canTransition('ready_to_ship', 'in_transit', 'shipping_staff')).toBe(true);
  });

  it('yanlış rol geçişi yapamaz', () => {
    expect(canTransition('placed', 'confirmed', 'shipping_staff')).toBe(false);
    expect(canTransition('placed', 'confirmed', 'customer_admin')).toBe(false);
  });

  it('producer_admin her tanımlı geçişi yapar', () => {
    expect(canTransition('placed', 'confirmed', 'producer_admin')).toBe(true);
    expect(canTransition('in_production', 'on_hold', 'producer_admin')).toBe(true);
  });

  it('tanımsız geçiş reddedilir', () => {
    expect(canTransition('placed', 'delivered', 'producer_admin')).toBe(false);
    expect(canTransition('delivered', 'placed', 'producer_admin')).toBe(false);
  });
});

describe('nextTransitions', () => {
  it('rolün o durumdan yapabileceklerini verir', () => {
    const steps = nextTransitions('placed', 'sales_staff').map((t) => t.to);
    expect(steps).toContain('confirmed');
    expect(steps).toContain('cancelled');
  });

  it('yetkisiz rol için boş', () => {
    expect(nextTransitions('placed', 'shipping_staff')).toHaveLength(0);
  });
});

describe('stockIsReserved', () => {
  it('onay ve sonrası rezerve sayılır', () => {
    for (const s of [
      'confirmed',
      'in_production',
      'production_done',
      'ready_to_ship',
      'in_transit',
      'on_hold',
    ] as OrderStatus[]) {
      expect(stockIsReserved(s)).toBe(true);
    }
  });

  it('placed ve cancelled rezerve değil', () => {
    expect(stockIsReserved('placed')).toBe(false);
    expect(stockIsReserved('cancelled')).toBe(false);
  });
});

describe('isTerminal', () => {
  it('delivered ve cancelled uç durum', () => {
    expect(isTerminal('delivered')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('placed')).toBe(false);
  });
});
