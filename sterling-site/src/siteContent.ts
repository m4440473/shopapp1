export type NavSection = {
  id: string;
  label: string;
};

export const navSections: NavSection[] = [
  { id: 'hero', label: 'Overview' },
  { id: 'brands', label: 'Brands' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'why-us', label: 'Why Us' },
  { id: 'trust', label: 'Trusted By' },
  { id: 'materials', label: 'Materials' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'contact', label: 'Contact' },
];

export const capabilities = [
  {
    title: 'CNC machining',
    body: 'Production-ready machining for complex parts, repeatable workholding, and dimensional consistency that holds up at volume.',
  },
  {
    title: '4-axis production',
    body: 'Ten four-axis CNC machines support multi-face parts, fewer handoffs, and stronger throughput for repeat programs.',
  },
  {
    title: 'Turning',
    body: 'Lathe capacity for turned features, shafts, round components, and repeat production with stable process control.',
  },
  {
    title: 'Fabrication',
    body: 'In-house fabrication supports weldments, assemblies, fixtures, and integrated builds without pushing work outside the facility.',
  },
  {
    title: 'Production part design',
    body: 'We design for manufacturability, iterate with production constraints in mind, and help turn concepts into buildable parts.',
  },
  {
    title: 'Paint and finishing',
    body: 'Surface prep, finishing coordination, and in-house paint workflows keep schedules tighter and quality more predictable.',
  },
  {
    title: 'Powder coating',
    body: 'Preferred Kustom Powder adds in-house powder coating so finished parts do not have to leave the building to reach final form.',
  },
  {
    title: 'Prototyping and 3D printing',
    body: 'Fast prototype support and additive tools accelerate design review, fixtures, and pre-production validation.',
  },
] as const;

export const differentiators = [
  { value: '.001', label: 'tolerance capability held regularly' },
  { value: '30K', label: 'square-foot unified manufacturing facility' },
  { value: '3', label: 'brands operating under one roof' },
  { value: '12+', label: 'core industrial materials handled in-house' },
] as const;

export const whyUs = [
  'Precision work that regularly holds .001 tolerances for serious industrial programs.',
  '30,000 sq ft under one roof, reducing handoff risk across machining, fabrication, finishing, and coating.',
  'A true one-stop manufacturing model from design support through finished part delivery.',
  'Broad material fluency across steels, stainlesses, aluminum, engineering plastics, and titanium.',
  'In-house finishing and powder coating through Preferred Kustom Powder for tighter schedules and cleaner accountability.',
  'Trusted by demanding industrial customers including Toyota, Yokohama, Corning, Icon Automation, S&K Industrial, and AVI.',
] as const;

export const supportedCompanies = [
  'Toyota',
  'Yokohama',
  'Corning',
  'Icon Automation',
  'S&K Industrial',
  'AVI',
  'And other serious industrial programs',
] as const;

export const materials = [
  '4140',
  'Cold rolled steel',
  'Hot rolled steel',
  'A2',
  '303 stainless',
  '304 stainless',
  '316 stainless',
  'Aluminum',
  'Nylon',
  'UHMW',
  'Delrin',
  'Titanium',
] as const;

export const equipment = [
  { count: '10', label: 'four-axis CNC machines' },
  { count: '4', label: 'standing CNC mills' },
  { count: '4', label: 'lathes' },
  { count: '3D', label: 'printing capability for prototype and tooling support' },
  { count: '1', label: 'integrated fabrication department' },
  { count: '1', label: 'paint and finishing workflow' },
  { count: '1', label: 'Preferred Kustom Powder coating line' },
] as const;

export const gallery = [
  {
    title: 'Precision machining cell',
    image:
      'https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&w=1200&q=80',
    note: 'Swap with real four-axis production photography when ready.',
  },
  {
    title: 'Fabrication workflow',
    image:
      'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
    note: 'Ideal replacement: welding, fixturing, or assembly floor imagery.',
  },
  {
    title: 'Finished coated parts',
    image:
      'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1200&q=80',
    note: 'Swap with Preferred Kustom Powder finishing and final-part shots.',
  },
] as const;

export const contactCards = [
  {
    title: 'Request a quote',
    body: 'Add your real quote inbox or form endpoint here when the team is ready to go live.',
    cta: 'quotes@your-company.com',
  },
  {
    title: 'Start a conversation',
    body: 'Use this space for your sales or operations contact line once direct details are finalized.',
    cta: '(555) 000-0000',
  },
] as const;
