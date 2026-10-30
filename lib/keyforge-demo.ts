export type DemoProduct = {
  id: string;
  name: string;
  code: string;
  platform: string;
  licenses: number;
  active: number;
  color: string;
};

export type DemoLicense = {
  id: string;
  name: string;
  key: string;
  product: string;
  status: "Activa" | "Por vencer" | "Suspendida";
  created: string;
  expires: string;
  machines: string;
};

export const demoProducts: DemoProduct[] = [
  { id: "demo-1", name: "Astra CLI", code: "astra-cli", platform: "Windows · macOS", licenses: 286, active: 241, color: "#67E8B3" },
  { id: "demo-2", name: "Vector Studio", code: "vector-studio", platform: "Windows", licenses: 174, active: 138, color: "#83A9FF" },
  { id: "demo-3", name: "Orbit SDK", code: "orbit-sdk", platform: "Linux · macOS", licenses: 92, active: 76, color: "#D6A4FF" },
];

export const demoLicenses: DemoLicense[] = [
  { id: "lic_demo_01", name: "Studio Team · Acme", key: "KF-7K2M••••-9QXA", product: "Astra CLI", status: "Activa", created: "09 oct 2026", expires: "09 oct 2027", machines: "3 / 5" },
  { id: "lic_demo_02", name: "Pro · Nadia Ruiz", key: "KF-4P8N••••-2MVD", product: "Vector Studio", status: "Activa", created: "08 oct 2026", expires: "08 oct 2027", machines: "1 / 2" },
  { id: "lic_demo_03", name: "Enterprise · Northstar", key: "KF-9R3D••••-8WTP", product: "Orbit SDK", status: "Por vencer", created: "01 oct 2025", expires: "15 oct 2026", machines: "18 / 25" },
  { id: "lic_demo_04", name: "Pro · Mateo C.", key: "KF-2J5B••••-6HNY", product: "Astra CLI", status: "Activa", created: "30 sep 2026", expires: "30 sep 2027", machines: "2 / 3" },
  { id: "lic_demo_05", name: "Trial · Soluciones MX", key: "KF-8C1F••••-3LQZ", product: "Vector Studio", status: "Suspendida", created: "19 sep 2026", expires: "19 oct 2026", machines: "0 / 1" },
];

export const demoActivity = [
  { title: "Licencia activada", detail: "Astra CLI · macOS · Hace 4 min", kind: "success" },
  { title: "Nuevo producto creado", detail: "Orbit SDK · Hace 1 h", kind: "info" },
  { title: "Clave próxima a vencer", detail: "Northstar · Vence en 5 días", kind: "warning" },
  { title: "Máquina desvinculada", detail: "Vector Studio · Windows · Hace 3 h", kind: "neutral" },
];
