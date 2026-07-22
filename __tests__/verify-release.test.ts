/**
 * Unit tests for the package availability probes in src/verifyRelease.ts
 */

import { isNugetPackageAvailable } from '../src/verifyRelease'

describe('isNugetPackageAvailable', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it.each([
    {
      scenario: 'the package is published',
      mockFetch: () => jest.fn().mockResolvedValue({ ok: true } as Response),
      expected: true
    },
    {
      scenario: 'the package is not published',
      mockFetch: () => jest.fn().mockResolvedValue({ ok: false } as Response),
      expected: false
    },
    {
      scenario: 'the request fails with a network error',
      mockFetch: () =>
        jest.fn().mockRejectedValue(new TypeError('fetch failed')),
      expected: false
    }
  ])('reports $expected when $scenario', async ({ mockFetch, expected }) => {
    global.fetch = mockFetch()

    await expect(
      isNugetPackageAvailable('pulumi.gcp', '9.31.0-alpha.1784719443')
    ).resolves.toBe(expected)
  })

  it('requests the lowercased package URL with HEAD', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response)

    await isNugetPackageAvailable('Pulumi.Gcp', '9.31.0-Alpha.1784719443')

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.nuget.org/v3-flatcontainer/pulumi.gcp/9.31.0-alpha.1784719443/pulumi.gcp.9.31.0-alpha.1784719443.nupkg',
      { method: 'HEAD' }
    )
  })
})
