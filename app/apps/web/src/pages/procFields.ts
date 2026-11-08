import { CONCERN_AREAS, CONCERN_STATUSES, CONCERN_TYPES, SEVERITIES } from '../api';
import type { FieldDef } from '../crud';

export const EXPEDITING_STATUSES = ['Normal', 'Under production', 'FAT', 'Final inspection', 'On sailing', 'Arrived', 'At Risk', 'At High Risk', 'Delay'] as const;
export const SHIPMENT_STATUSES = ['Planned', 'On Sailing', 'Under Customs', 'Inland transportation', 'Received'] as const;

export const packageFields = (sug: { discipline: string[]; vendor: string[]; buyer: string[]; expeditor: string[]; workPackage: string[] }): FieldDef[] => [
  { key: 'code', label: 'Package code', required: true, max: 60, hint: 'Unique in the project, e.g. STTP2B-GF-STR-001A' },
  { key: 'discipline', label: 'Discipline', suggestions: sug.discipline, max: 40 },
  { key: 'description', label: 'Description', kind: 'textarea', rows: 2, max: 300 },
  { key: 'workPackage', label: 'Work package', suggestions: sug.workPackage, max: 40, placeholder: 'WP2' },
  { key: 'packageType', label: 'Contract type', kind: 'select', options: ['LS', 'PS', 'Free issue'] },
  { key: 'weightPct', label: 'Weight in progress (%)', kind: 'number', min: 0, hint: 'Share of overall procurement progress' },
  { key: 'vendorCode', label: 'Vendor code', max: 40 },
  { key: 'vendor', label: 'Vendor', suggestions: sug.vendor, max: 160, full: true, hint: 'Naming a vendor moves a Planned package to In tendering' },
  { key: 'origins', label: 'Manufacturers / origins', max: 200, full: true },
  { key: 'loaNo', label: 'LOA number', max: 80, hint: 'With an LOA the status becomes LOA issued' },
  { key: 'loaDate', label: 'LOA date', kind: 'date' },
  { key: 'poNo', label: 'PO number', max: 80, hint: 'With a PO the status becomes PO placed' },
  { key: 'poDate', label: 'PO date', kind: 'date' },
  { key: 'buyer', label: 'Buyer', suggestions: sug.buyer, max: 80 },
  { key: 'expeditor', label: 'Expeditor', suggestions: sug.expeditor, max: 80 },
  { key: 'pe', label: 'Project engineer (PE)', max: 80 },
  { key: 'vqc', label: 'VQC', max: 80 },
];

export const expeditingFields = (sug: { discipline: string[]; vendor: string[] }): FieldDef[] => [
  { key: 'code', label: 'Package code', required: true, max: 60 },
  { key: 'discipline', label: 'Discipline', suggestions: sug.discipline, max: 40 },
  { key: 'name', label: 'Package name', kind: 'textarea', rows: 2, max: 300 },
  { key: 'vendor', label: 'Vendor', suggestions: sug.vendor, max: 160, full: true },
  { key: 'status', label: 'Status', kind: 'select', required: true, options: EXPEDITING_STATUSES },
  { key: 'rosDate', label: 'ROS date', kind: 'date' },
  { key: 'planPct', label: 'Plan progress (%)', kind: 'number', min: 0 },
  { key: 'actualPct', label: 'Actual progress (%)', kind: 'number', min: 0, hint: 'The variance is worked out from plan and actual' },
  { key: 'etaSite', label: 'ETA at site', max: 40 },
  { key: 'dateDiff', label: 'Date difference', max: 40 },
  { key: 'highlight', label: 'Highlight (what is wrong or at risk)', kind: 'textarea', max: 1000, hint: 'Packages that are late or at risk with a highlight appear as expediting flags' },
  { key: 'actionPlan', label: 'Action plan', kind: 'textarea', max: 1000 },
  { key: 'remark', label: 'Remark', kind: 'textarea', max: 1000 },
  ...(['eng:Engineering', 'proc:Procurement', 'fab:Fabrication', 'test:Testing', 'del:Delivery'] as const).flatMap(s => {
    const [k, label] = s.split(':');
    return [{ key: `${k}Plan`, label: `${label} plan (%)`, kind: 'number' as const, min: 0 }, { key: `${k}Actual`, label: `${label} actual (%)`, kind: 'number' as const, min: 0 }];
  }),
  { key: 'planExw', label: 'Ex-works plan (%)', kind: 'number', min: 0 },
  { key: 'actExw', label: 'Ex-works actual (%)', kind: 'number', min: 0 },
  { key: 'planArrival', label: 'Arrival plan (%)', kind: 'number', min: 0 },
  { key: 'actArrival', label: 'Arrival actual (%)', kind: 'number', min: 0 },
  { key: 'poNo', label: 'PO number', max: 80 },
  { key: 'deliveryDate', label: 'PO delivery date', max: 40 },
  { key: 'currentStatusText', label: 'Current status', kind: 'textarea', max: 500 },
];

export const shipmentFields = (sug: { yard: string[]; transport: string[] }): FieldDef[] => [
  { key: 'source', label: 'Supply', kind: 'select', required: true, options: ['PTSC', 'Client'] },
  { key: 'status', label: 'Status', kind: 'select', required: true, options: SHIPMENT_STATUSES, hint: 'An actual on-site date makes it Received' },
  { key: 'packageNo', label: 'Package / ITB number', required: true, max: 80, full: true },
  { key: 'packageDescription', label: 'Package description', max: 200, full: true },
  { key: 'poNo', label: 'PO number', max: 80 },
  { key: 'shipmentNo', label: 'Shipment number', max: 60 },
  { key: 'shipmentDescription', label: 'Shipment description', max: 200, full: true },
  { key: 'etdPol', label: 'ETD port of loading', kind: 'date' },
  { key: 'etaPod', label: 'ETA port of discharge', kind: 'date' },
  { key: 'forecastOnSite', label: 'Forecast on site', kind: 'date' },
  { key: 'actualOnSite', label: 'Actual on site', kind: 'date' },
  { key: 'grossWeightKg', label: 'Gross weight (kg)', kind: 'number', min: 0 },
  { key: 'qty', label: 'Quantity / packages', max: 80 },
  { key: 'packingList', label: 'Packing list', max: 80 },
  { key: 'vessel', label: 'Vessel / flight', max: 80 },
  { key: 'blNo', label: 'BL / AWB number', max: 80 },
  { key: 'portLoading', label: 'Port of loading', max: 80 },
  { key: 'portDischarge', label: 'Port of discharge', max: 80 },
  { key: 'transport', label: 'Transport', suggestions: sug.transport, max: 60 },
  { key: 'deliveryYard', label: 'Delivery yard', suggestions: sug.yard, max: 60 },
  { key: 'issue', label: 'Pending / issue / stuck / concern', kind: 'textarea', max: 500, hint: 'A shipment with a note here counts as held until it is received' },
];

export const stockFields = (sug: { facility: string[]; supply: string[]; discipline: string[]; category: string[]; yard: string[] }): FieldDef[] => [
  { key: 'description', label: 'Description', kind: 'textarea', required: true, rows: 2, max: 300 },
  { key: 'facility', label: 'Facility', suggestions: sug.facility, max: 60 },
  { key: 'supply', label: 'Supply', suggestions: sug.supply, max: 40 },
  { key: 'discipline', label: 'Discipline', suggestions: sug.discipline, max: 40 },
  { key: 'category', label: 'Category', suggestions: sug.category, max: 40 },
  { key: 'materialCode', label: 'Material code', max: 60 },
  { key: 'serialNo', label: 'Serial no', max: 40 },
  { key: 'grade', label: 'Grade', max: 60 },
  { key: 'balance', label: 'Balance', kind: 'number', min: 0 },
  { key: 'unit', label: 'Unit', max: 20 },
  { key: 'poNo', label: 'PO number', max: 80 },
  { key: 'shipmentNo', label: 'Shipment', max: 40 },
  { key: 'supplier', label: 'Supplier', max: 100, full: true },
  { key: 'mrirNo', label: 'MRIR number', max: 60 },
  { key: 'heatNo', label: 'Heat number', max: 60 },
  { key: 'yard', label: 'Yard / warehouse', suggestions: sug.yard, max: 40 },
  { key: 'location', label: 'Location', max: 80 },
  { key: 'status', label: 'Status', max: 40 },
  { key: 'remark', label: 'Remark', kind: 'textarea', max: 200 },
];

export const weightFields: FieldDef[] = [
  { key: 'supply', label: 'Supply', kind: 'select', required: true, options: ['PTSC MC', 'Client'] },
  { key: 'facility', label: 'Facility', required: true, max: 80 },
  { key: 'mtoKg', label: 'Needed for purchase (kg)', kind: 'number', min: 0 },
  { key: 'arrivedKg', label: 'Arrived (kg)', kind: 'number', min: 0 },
  { key: 'vspYardKg', label: 'On VSP yard / transferred (kg)', kind: 'number', min: 0 },
  { key: 'mcYardKg', label: 'On MC yard (kg)', kind: 'number', min: 0 },
];

export const concernFields = (packages: string[]): FieldDef[] => [
  { key: 'title', label: 'Title', required: true, max: 200, full: true },
  { key: 'type', label: 'Type', kind: 'select', required: true, options: CONCERN_TYPES, hint: 'Risk: may happen. Concern: worrying. Issue: already happening' },
  { key: 'severity', label: 'Severity', kind: 'select', required: true, options: SEVERITIES },
  { key: 'packageCode', label: 'Package', suggestions: packages, max: 60, hint: 'Pick a code from the procurement or expediting register' },
  { key: 'area', label: 'Area', kind: 'select', required: true, options: CONCERN_AREAS },
  { key: 'description', label: 'Description', kind: 'textarea', max: 1500, rows: 4 },
  { key: 'action', label: 'Mitigation / action', kind: 'textarea', max: 1500, rows: 3 },
  { key: 'owner', label: 'Owner', max: 80 },
  { key: 'status', label: 'Status', kind: 'select', required: true, options: CONCERN_STATUSES },
  { key: 'raisedDate', label: 'Raised', kind: 'date', hint: 'Defaults to the cut-off date' },
  { key: 'dueDate', label: 'Action due', kind: 'date' },
];
