/**
 * Unit tests for the package availability probes in src/verifyRelease.ts
 */

import { isNugetPackageAvailable } from '../src/verifyRelease'

describe('isNugetPackageAvailable', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('reports unavailable when the request fails with a network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'))

    await expect(
      isNugetPackageAvailable('pulumi.gcp', '9.31.0-alpha.1784719443')
    ).resolves.toBe(false)
  })

  it('requests the lowercased package URL with HEAD', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response)

    await isNugetPackageAvailable('Pulumi.Gcp', '9.31.0-Alpha.1784719443')

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.nuget.org/v3-flatcontainer/pulumi.gcp/9.31.0-alpha.1784719443/pulumi.gcp.9.31.0-alpha.1784719443.nupkg',
      { method: 'HEAD' }
    )
  })

  it('reports available when the package is published', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response)

    await expect(
      isNugetPackageAvailable('pulumi.gcp', '9.31.0-alpha.1784719443')
    ).resolves.toBe(true)
  })

  it('reports unavailable when the package is not published', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false } as Response)

    await expect(
      isNugetPackageAvailable('pulumi.gcp', '9.31.0-alpha.1784719443')
    ).resolves.toBe(false)
  })
})
