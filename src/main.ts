import { access } from 'fs/promises'
import * as core from '@actions/core'
import { verifyRelease } from './verifyRelease'
import { parse } from 'semver'

const supportedRuntimes = ['python', 'nodejs', 'dotnet', 'go', 'java', 'yaml']

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const runtime: string = core.getInput('runtime')
    const directory: string = core.getInput('directory')
    const provider: string = core.getInput('provider')
    const providerVersion: string = core.getInput('providerVersion')
    let packageVersion: string = core.getInput('packageVersion')
    if (packageVersion === '') {
      packageVersion = providerVersion
    }
    const publisher: string = core.getInput('publisher')
    const goModuleTemplate: string = core.getInput('goModuleTemplate')

    if (!supportedRuntimes.includes(runtime)) {
      throw new Error(`Unsupported runtime: ${runtime}`)
    }

    // Ensure directory exists
    try {
      await access(directory)
    } catch (error) {
      core.setFailed(`Can't access directory ${directory}: ${error}`)
      return
    }

    const parsedProviderVersion = parse(providerVersion)
    if (parsedProviderVersion === null) {
      core.setFailed(`Invalid provider version: ${providerVersion}`)
      return
    }

    await verifyRelease({
      runtime,
      directory,
      provider,
      providerVersion,
      packageVersion,
      publisher,
      goModuleTemplate
    })
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed(`An unknown error occurred: ${error}`)
    }
  }
}
