import remote from './remote.js'
export const TYPERT = {
  package: remote.package,
  face: 'host' as const,
  schemas: [],
  invocations: remote.descriptors,
  model: { services: [], events: [], objects: [] },
}
export default TYPERT
