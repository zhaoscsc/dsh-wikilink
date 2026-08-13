/**
 * Pure display projections for the @file picker: the split of a relative path
 * into basename + directory for the picker rows. (The model forms moved to
 * the Host's mention expansion, which is the sole content producer now.)
 */

/** The directory prefix of a forward-slash relative path ('' for root-level files). */
export function dirnameOf(relative: string): string {
  const at = relative.lastIndexOf('/')
  return at < 0 ? '' : relative.slice(0, at)
}

/** The basename of a forward-slash relative path. */
export function basenameOf(relative: string): string {
  const at = relative.lastIndexOf('/')
  return at < 0 ? relative : relative.slice(at + 1)
}
