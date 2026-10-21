import { describe, expect, it } from 'vitest';
import { calculateCompanyMonthlyFee, totalActiveCompanyFees } from './saasBilling';

describe('SaaS company billing', () => {
  it('calculates monthly fees from each company camera price and quantity', () => {
    expect(calculateCompanyMonthlyFee(11, 3)).toBe(33);
    expect(calculateCompanyMonthlyFee(7.5, 2)).toBe(15);
    expect(calculateCompanyMonthlyFee(11, 0)).toBe(0);
  });
  it('totals only active company charges, not client monthly fees', () => {
    expect(totalActiveCompanyFees([{ id: 'a', status: 'active' }, { id: 'b', status: 'inactive' }], [
      { company_id: 'a', price_per_camera: 11, cameras_count: 3, monthly_fee: 33 },
      { company_id: 'b', price_per_camera: 20, cameras_count: 2, monthly_fee: 40 },
    ])).toBe(33);
  });
});