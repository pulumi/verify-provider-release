import * as core from '@actions/core'
import { LocalWorkspace } from '@pulumi/pulumi/automation'
import * as path from 'path'
import * as fs from 'fs/promises'
import shell from 'shelljs'

export interface VerifyReleaseOptions {
  language: string
  directory: string
  provider: string
  providerVersion: string
  packageVersion: string
  publisher: string
}

/**
 * Performs a preview of the application using the specific SDK and therefore provider version.
 * @param milliseconds The number of milliseconds to wait.
 * @returns {Promise<string>} Resolves with 'done!' after the wait is over.
 */
export async function verifyRelease(opts: VerifyReleaseOptions): Promise<void> {
  // Copy to temporary directory to avoid modifying the original
  core.debug(`Creating temporary directory`)
  const tempDir = await fs.mkdtemp(
    path.join(shell.tempdir(), 'pulumi-verify-release-')
  )
  core.debug(`Copying ${opts.directory} to ${tempDir}`)
  shell.cp('-r', opts.directory, tempDir)
  const wd = path.join(tempDir, path.basename(opts.directory))
  core.debug(`Temp working directory: ${wd}`)

  try {
    core.debug(`Creating stack "verify-release" in ${wd}`)
    const stack = await LocalWorkspace.createStack(
      {
        stackName: 'verify-release',
        workDir: wd
      },
      {
        workDir: opts.directory,
        // Force use of a local backend for isolation
        secretsProvider: 'passphrase',
        envVars: {
          PULUMI_CONFIG_PASSPHRASE: 'correct-horse-battery-staple',
          PULUMI_BACKEND_URL: `file://${tempDir}`,
          // Disable ambient plugins to ensure the correct provider version is downloaded in case there's a local build on the path
          PULUMI_IGNORE_AMBIENT_PLUGINS: 'true'
        }
      }
    )

    await installPackageVersion(wd, opts)

    core.debug(`Running pulumi preview`)
    const previewResult = await stack.preview({})
    core.debug(previewResult.stdout)
    core.debug(previewResult.stderr)
  } finally {
    core.debug(`Cleaning up temporary directory`)
    shell.rm('-rf', tempDir)
  }
}

async function installPackageVersion(
  wd: string,
  opts: VerifyReleaseOptions
): Promise<void> {
  switch (opts.language) {
    case 'nodejs':
      await installNpmPackageVersion(wd, opts)
      break
  }
}

async function installNpmPackageVersion(
  wd: string,
  opts: VerifyReleaseOptions
): Promise<void> {
  const shellOpts = { cwd: wd }
  const packageRef = `@${opts.publisher}/${opts.provider}`
  core.debug(`Removing any existing npm package: ${packageRef}`)
  shell.exec(`npm remove ${packageRef}`, shellOpts)

  const packageVersionRef = `${packageRef}@${opts.providerVersion}`
  core.debug(`Installing npm package: ${packageVersionRef}`)
  shell.exec(`npm install ${packageVersionRef}`, shellOpts)
}
