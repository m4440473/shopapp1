export type FeedsSpeedsMachineProfile = {
  id: string;
  name: string;
  maxRpm: number;
  maxCuttingFeedIpm: number;
  maxSpindleHorsepower: number;
  maxSpindleTorqueFtLb: number;
  torqueReferenceRpm: number;
};

export const HAAS_VF2SS_MACHINE: FeedsSpeedsMachineProfile = {
  id: 'haas-vf2ss',
  name: 'Haas VF-2SS',
  maxRpm: 12_000,
  maxCuttingFeedIpm: 833,
  maxSpindleHorsepower: 30,
  maxSpindleTorqueFtLb: 90,
  torqueReferenceRpm: 2_000,
};

export const feedsSpeedsMachineProfiles = [HAAS_VF2SS_MACHINE] as const;

export function getFeedsSpeedsMachineProfile(id: string) {
  return feedsSpeedsMachineProfiles.find((profile) => profile.id === id) ?? HAAS_VF2SS_MACHINE;
}
