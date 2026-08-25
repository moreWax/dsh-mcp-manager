import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
describe('dsh manifest',()=>{it('ships an active host/client bundle',()=>{const p=JSON.parse(readFileSync('package.json','utf8'));expect(p.dsh.bundle.patch).toBe('./cordis.patch.yml');expect(p.dsh.client.platform).toBe('web');const rows=parse(readFileSync('cordis.patch.yml','utf8'));expect(rows[0].insert[0].id).toBe('mcp-manager')})})
