import ts from 'typescript'
import { defineConfig } from 'tsdown'

const lowerDecorators = {
  name: 'lower-standard-decorators',
  transform(code: string, id: string) {
    if (!/\.[cm]?tsx?$/.test(id) || !/^\s*@[A-Za-z_$][\w$]*/m.test(code)) return
    const result = ts.transpileModule(code, {
      fileName: id,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    })
    return { code: result.outputText }
  },
}

export default defineConfig({
  entry: {
    'host/index': 'src/host/index.ts',
    'client/index': 'src/client/index.tsx',
    'typert.remote-client': 'src/remote.ts',
    'typert.host': 'src/typert-host.ts',
  },
  format: 'esm', dts: true, outDir: 'lib', plugins: [lowerDecorators],
})
