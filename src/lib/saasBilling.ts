export interface CompanyBilling {
  company_id: string;
  price_per_camera: number;
  cameras_count: number;
  monthly_fee: number;
}

export function calculateCompanyMonthlyFee(pricePerCamera: number, camerasCount: number): number {
  return Math.round(pricePerCamera * 100) * camerasCount / 100;
}

export function totalActiveCompanyFees(companies: { id: string; status: string }[], billing: CompanyBilling[]): number {
  return companies.reduce((total, company) => {
    if (company.status !== 'active') return total;
    const charge = billing.find((row) => row.company_id === company.id);
    return total + (charge ? calculateCompanyMonthlyFee(charge.price_per_camera, charge.cameras_count) : 0);
  }, 0);
}