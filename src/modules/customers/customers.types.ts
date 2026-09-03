export type CustomerContactWriteInput = {
  id?: string;
  name: string;
  title?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

export type CustomerWriteInput = {
  name?: string;
  contact?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
  address?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
  contacts?: CustomerContactWriteInput[];
};

export type StructuredCustomerAddress = Pick<
  CustomerWriteInput,
  'addressLine1' | 'addressLine2' | 'city' | 'stateProvince' | 'postalCode' | 'country'
>;
