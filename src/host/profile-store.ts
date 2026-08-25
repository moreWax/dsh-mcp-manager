import { appendFile, readFile, writeFile } from 'node:fs/promises'

const serverMarker = (serverName: string) => `- id: mcp-${serverName}\n`

/** File-backed profile patch operations, isolated from credentials and request policy. */
export class ProfilePatchStore {
  constructor(private readonly path: string) {}

  private async read(): Promise<string> {
    return readFile(this.path, 'utf8').catch(() => '')
  }

  async hasServer(serverName: string): Promise<boolean> {
    return (await this.read()).includes(serverMarker(serverName))
  }

  async appendServer(row: string): Promise<void> {
    await appendFile(this.path, `\n${row}\n`, 'utf8')
  }

  async listServers(): Promise<string[]> {
    return [...(await this.read()).matchAll(/- id: mcp-([A-Za-z0-9_-]{1,32})\n/g)]
      .map((match) => match[1]!)
  }

  async removeServer(serverName: string): Promise<boolean> {
    const raw = await this.read()
    const marker = serverMarker(serverName)
    const start = raw.indexOf(marker)
    if (start === -1) return false

    const contentAfterMarker = raw.slice(start + marker.length)
    const nextRow = contentAfterMarker.search(/^(- (?:id|insert):)/m)
    const end = nextRow === -1 ? raw.length : start + marker.length + nextRow
    const updated = raw.slice(0, start) + raw.slice(end).replace(/^\n+/, '\n')
    await writeFile(this.path, updated, 'utf8')
    return true
  }
}
