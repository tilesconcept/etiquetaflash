import type { NormalizedOrder } from '@/types/order';

// Pedidos mock para desarrollo sin OAuth.
// Activado con MOCK_MODE=true en .env.
export const mockOrders: NormalizedOrder[] = [
  {
    id: '',
    tiendaNubeOrderId: '100001',
    orderNumber: '1001',
    status: 'open',
    paymentStatus: 'paid',
    shippingStatus: 'unpacked',
    totalAmount: 45990,
    currency: 'ARS',
    customer: {
      firstName: 'María',
      lastName: 'García',
      fullName: 'María García',
      email: 'maria.garcia@example.com',
      phone: '+5491145678901',
      document: '32.456.789',
    },
    shipTo: {
      street: 'Av. Corrientes',
      number: '1234',
      floor: '5B',
      city: 'CABA',
      province: 'Ciudad Autónoma de Buenos Aires',
      postalCode: '1043',
      country: 'AR',
    },
    items: [
      { name: 'Porcelanato Calacatta 60x60', sku: 'PORC-CAL-60', quantity: 4, unitPrice: 8500 },
      { name: 'Pegamento Klaukol 30kg', sku: 'KLA-30', quantity: 2, unitPrice: 5995 },
    ],
    shippingMethod: 'Correo Argentino',
    labelGenerated: false,
  },
  {
    id: '',
    tiendaNubeOrderId: '100002',
    orderNumber: '1002',
    status: 'open',
    paymentStatus: 'paid',
    shippingStatus: 'unpacked',
    totalAmount: 12300,
    currency: 'ARS',
    customer: {
      firstName: 'Juan',
      lastName: 'Pérez',
      fullName: 'Juan Pérez',
      email: 'juan@example.com',
      phone: '+542915554433',
      document: '20.111.222',
    },
    shipTo: {
      street: 'San Martín',
      number: '500',
      city: 'Bahía Blanca',
      province: 'Buenos Aires',
      postalCode: '8000',
      country: 'AR',
    },
    items: [
      { name: 'Cerámica Blanca 30x30', sku: 'CER-BL-30', quantity: 6, unitPrice: 2050 },
    ],
    shippingMethod: 'Correo Argentino',
    labelGenerated: false,
  },
  {
    id: '',
    tiendaNubeOrderId: '100003',
    orderNumber: '1003',
    status: 'open',
    paymentStatus: 'paid',
    shippingStatus: 'unpacked',
    totalAmount: 89500,
    currency: 'ARS',
    customer: {
      firstName: 'Lucía',
      lastName: '',
      fullName: 'Lucía',
      email: 'lucia@example.com',
      // Teléfono vacío a propósito → debe disparar validación.
      phone: '',
      document: '',
    },
    shipTo: {
      street: 'Av. Belgrano',
      number: '750',
      city: 'Rosario',
      province: 'Santa Fe',
      // CP vacío a propósito → debe disparar validación.
      postalCode: '',
      country: 'AR',
    },
    items: [
      { name: 'Mosaico Vidriado Azul', sku: 'MOS-AZ', quantity: 10, unitPrice: 8950 },
    ],
    shippingMethod: 'Sinergia',
    labelGenerated: false,
  },
];
