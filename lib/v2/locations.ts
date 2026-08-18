// ================================================================
// v2 STUB: multi-location support
//
// Not implemented in v1. Nothing imports this module yet.
//
// The schema is already forward compatible: stamp_events and
// loyalty_settings both carry a nullable location_id column that v1
// leaves null. v2 plan:
// - Add a locations table (id, name, address).
// - Stamp events record the granting location via the staff profile.
// - Settings optionally vary per location.
// - Owner dashboard filters by location.
// ================================================================

export interface Location {
  id: string;
  name: string;
  address: string;
}

export async function listLocations(): Promise<Location[]> {
  throw new Error("Multi-location support is planned for v2");
}
