from pathlib import Path

p = Path('/tmp/memories-phase5.sh')
s = p.read_text()
s = s.replace('const photoChain: Record<string, unknown> = {};', 'const photoChain: any = {};', 1)
s = s.replace('mocks.storageUpload.mock.invocationCallOrder[0]).toBeLessThan(\n      mocks.photoInsert.mock.invocationCallOrder[0],', 'mocks.storageUpload.mock.invocationCallOrder[0]!).toBeLessThan(\n      mocks.photoInsert.mock.invocationCallOrder[0]!,', 1)
s = s.replace('mocks.storageRemove.mock.invocationCallOrder[0]).toBeLessThan(\n      mocks.photoUpdateEq.mock.invocationCallOrder[0],', 'mocks.storageRemove.mock.invocationCallOrder[0]!).toBeLessThan(\n      mocks.photoUpdateEq.mock.invocationCallOrder[0]!,', 1)
p.write_text(s)
