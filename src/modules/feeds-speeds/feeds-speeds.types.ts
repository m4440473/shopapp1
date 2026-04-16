export type FswizardToolType = {
  id: number;
  name: string;
  short_name?: string;
  type: string;
  subtype?: string;
  priority?: number;
  sfm: number;
  ipt: number;
  ipr_mode: boolean;
  flutes?: number;
  diameter?: number;
  flute_len?: number;
  tool_len?: number;
  default_len?: number;
  default_flute_len?: number;
  shank_dia?: number;
  corner_radius?: number;
  slot_doc?: number;
  slot_ipt_factor?: number;
  slot_sfm_factor?: number;
  side_doc?: number;
  side_woc?: number;
  pilot_size?: number;
  peck?: number;
  ramp_angle?: number;
  ramp_angle_feed_factor?: number;
  max_ramp_angle?: number;
  max_ramp_angle_feed?: number;
  leadangle?: number;
  helix?: number;
  rigid?: number;
  usage?: string;
  default_chip_thinning?: boolean | number;
};

export type FswizardMaterial = {
  id: number;
  name: string;
  sfm: number;
  max_sfm?: number;
  min_sfm?: number;
  ipt?: number;
  ipt_carbide?: number;
  hb?: number;
  group?: number;
  group_leader?: number;
  min_hb?: number;
  max_hb?: number;
  min_kp?: number;
  max_kp?: number;
  max_ipt?: number;
  kp?: number;
  material_reduction?: number;
  material_ipt_reduction?: number;
  coating_reduction?: number;
};

export type FswizardToolMaterial = {
  id: number;
  name: string;
  sfm: number;
  ipt: number;
  rigid?: number;
  uts?: number;
  coating_reduction?: number;
};

export type FswizardToolCoating = {
  id: number;
  name: string;
  sfm: number;
  ipt: number;
  color?: string;
  application?: string;
};

export type FswizardChipload = {
  tool_type: string;
  dia: number;
  ipt: number;
};

export type FeedsSpeedsInputs = {
  toolTypeId: string;
  materialId: string;
  toolMaterialId: string;
  coatingId: string;
  diameter: number;
  fluteCount: number;
  doc: number;
  woc: number;
  workDiameter: number;
  threadLead: number;
};

export type FeedsSpeedsResult = {
  tool: FswizardToolType;
  material: FswizardMaterial;
  toolMaterial: FswizardToolMaterial;
  coating: FswizardToolCoating;
  sfm: number;
  sfmHigh: number | null;
  rpm: number;
  chipLoadPerTooth: number;
  ipr: number;
  feedRate: number;
  plungeFeed: number | null;
  rampFeed: number | null;
  slotDoc: number | null;
  sideDoc: number | null;
  sideWoc: number | null;
  peckDepth: number | null;
  pilotDiameter: number | null;
  threadFeed: number | null;
  torqueRisk: 'low' | 'medium' | 'high';
  warnings: string[];
};
