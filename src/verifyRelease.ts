import * as core from '@actions/core'
import { LocalWorkspace } from '@pulumi/pulumi/automation'
import * as path from 'path'
import * as fs from 'fs/promises'
import shell from 'shelljs'

export interface VerifyReleaseOptions {
  runtime: string
  directory: string
  provider: string
  providerVersion: string
  packageVersion: string
  publisher: string
  goModuleTemplate: string
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
          PULUMI_BACKEND_URL: buildBackendPath(tempDir),
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
  switch (opts.runtime) {
    case 'nodejs':
      await installNpmPackageVersion(wd, opts)
      break
    case 'python':
      await installPipPackageVersion(wd, opts)
      break
    case 'dotnet':
      await installDotnetPackageVersion(wd, opts)
      break
    case 'go':
      await installGoPackageVersion(wd, opts)
      break
  }
}

async function installNpmPackageVersion(
  cwd: string,
  opts: VerifyReleaseOptions
): Promise<void> {
  const packageRef = `@${opts.publisher}/${opts.provider}`
  // Wait for up to 15 minutes for the package to be available on PyPI
  const startTime = Date.now()
  while (!isNpmPackageAvailable(cwd, packageRef, opts.packageVersion)) {
    core.debug(
      `Waiting for ${packageRef}@${opts.packageVersion} to be available on NPM`
    )
    if (Date.now() - startTime > 15 * 60 * 1000) {
      throw new Error(
        `Timed out waiting for ${packageRef}@${opts.packageVersion} to be available on NPM`
      )
    }
    await new Promise(resolve => setTimeout(resolve, 5000)) // 5 seconds
  }
  core.debug(`Removing any existing npm package: ${packageRef}`)
  shell.exec(`npm remove ${packageRef}`, { cwd })

  const packageVersionRef = `${packageRef}@${opts.packageVersion}`
  core.debug(`Installing npm package: ${packageVersionRef}`)
  shell.exec(`npm install ${packageVersionRef}`, { cwd, fatal: true })
}

function isNpmPackageAvailable(
  cwd: string,
  packageRef: string,
  packageVersion: string
): boolean {
  const checkVersionExistsCmd = shell.exec(
    `npm info ${packageRef}@${packageVersion} version`,
    {
      cwd,
      silent: true,
      fatal: false
    }
  )
  if (checkVersionExistsCmd.code !== 0) {
    return false
  }
  if (!checkVersionExistsCmd.stdout.includes(packageVersion)) {
    throw new Error(
      `Returned package version doesn't match requested version: ${checkVersionExistsCmd.stdout}`
    )
  }
  return true
}

async function installPipPackageVersion(
  cwd: string,
  opts: VerifyReleaseOptions
): Promise<void> {
  const packageRef = `${opts.publisher}-${opts.provider}`
  const vEnvCmd = `python3 -m venv venv`
  core.debug(`Creating virtualenv: ${vEnvCmd}`)
  if (shell.exec(vEnvCmd, { cwd, fatal: true }).code !== 0) {
    throw new Error('Failed to create virtualenv')
  }

  let pip = './venv/bin/pip'
  if (process.platform === 'win32') {
    pip = 'venv\\Scripts\\python3.exe -m pip'
  }

  const uninstallCmd = `${pip} uninstall -y ${packageRef}`
  core.debug(`Removing any existing pip package: ${uninstallCmd}`)
  if (shell.exec(uninstallCmd, { cwd }).code !== 0) {
    core.debug(`Failed to uninstall ${packageRef}`)
  }

  // Wait for up to 15 minutes for the package to be available on PyPI
  const startTime = Date.now()
  while (!isPypiPackageAvailable(cwd, pip, packageRef, opts.packageVersion)) {
    core.debug(
      `Waiting for ${packageRef}==${opts.packageVersion} to be available on PyPI`
    )
    if (Date.now() - startTime > 15 * 60 * 1000) {
      throw new Error(
        `Timed out waiting for ${packageRef}==${opts.packageVersion} to be available on PyPI`
      )
    }
    await new Promise(resolve => setTimeout(resolve, 5000)) // 5 seconds
  }

  const packageVersionRef = `${packageRef}==${opts.packageVersion}`
  const installCmd = `${pip} install ${packageVersionRef}`
  core.debug(`Installing pip package: ${installCmd}`)
  if (shell.exec(installCmd, { cwd, fatal: true }).code !== 0) {
    throw new Error(`Failed to install ${packageVersionRef}`)
  }

  const installReqCmd = `${pip} install -r requirements.txt`
  core.debug(`Installing requirements.txt: installReqCmd`)
  if (shell.exec(installReqCmd, { cwd, fatal: true }).code !== 0) {
    throw new Error(`Failed to install requirements.txt`)
  }
}

function isPypiPackageAvailable(
  cwd: string,
  pip: string,
  packageRef: string,
  packageVersion: string
): boolean {
  const versions = shell.exec(`${pip} index versions --pre "${packageRef}"`, {
    cwd,
    silent: true
  }).stdout
  return versions.includes(packageVersion)
}

async function installDotnetPackageVersion(
  cwd: string,
  opts: VerifyReleaseOptions
): Promise<void> {
  const packageRef = `${opts.publisher}.${opts.provider}`
  const removeCmd = `dotnet remove package ${packageRef}`
  core.debug(`Removing any existing dotnet package: ${removeCmd}`)
  const removeExec = shell.exec(removeCmd, { cwd })
  if (removeExec.code !== 0) {
    core.debug(
      `Failed to remove ${packageRef}: \n${removeExec.stderr}\n${removeExec.stdout}`
    )
  }

  // Wait for up to 1 hour for the package to be available on NuGet
  const startTime = Date.now()
  while (!(await isNugetPackageAvailable(packageRef, opts.packageVersion))) {
    core.debug(
      `Waiting for ${packageRef}==${opts.packageVersion} to be available on NuGet`
    )
    if (Date.now() - startTime > 60 * 60 * 1000) {
      throw new Error(
        `Timed out waiting for ${packageRef}==${opts.packageVersion} to be available on NuGet`
      )
    }
    await new Promise(resolve => setTimeout(resolve, 5000)) // 5 seconds
  }

  const packageVersionRef = `${packageRef} --version "[${opts.packageVersion}]"`
  const addCmd = `dotnet add package ${packageVersionRef}`
  core.debug(`Installing dotnet package: ${addCmd}`)
  const addExec = shell.exec(addCmd, { cwd, fatal: true })
  if (addExec.code !== 0) {
    throw new Error(
      `Failed to install ${packageVersionRef}: \n${addExec.stderr}\n${addExec.stdout}`
    )
  }

  // Recursively delete the folder ${cwd}/obj to make sure obj/project.assets.json is deleted. This is a workaround for
  // .NET version selection, sometimes on Mac OS and Windows runners when .NET 8 and 9 are available together, `dotnet
  // add package` uses 9 but `pulumi preview` uses 8 and fails to read obj/project.assets.json that references 9. In
  // contrast, ubuntu-latest runners succeed and select 8 uniformly.
  //
  // With this workaround `pulumi preview` no longer fails but re-fetches the refs to rebuild obj/project.assets.json.
  const objPath = path.join(cwd, 'obj')
  core.debug(`Cleaning up obj folder: ${objPath}`)
  try {
    await fs.rm(objPath, { recursive: true, force: true })
  } catch (err) {
    core.debug(`Failed to remove obj folder: ${err}`)
  }
}

async function isNugetPackageAvailable(
  packageRef: string,
  packageVersion: string
): Promise<boolean> {
  // API methods: https://api.nuget.org/v3/index.json
  const url = `https://api.nuget.org/v3-flatcontainer/${packageRef.toLowerCase()}/${packageVersion.toLowerCase()}/${packageRef.toLowerCase()}.${packageVersion.toLowerCase()}.nupkg`
  const response = await fetch(url, {
    method: 'HEAD'
  })

  return response.ok
}

async function installGoPackageVersion(
  cwd: string,
  opts: VerifyReleaseOptions
): Promise<void> {
  const majorVersion = parseInt(opts.providerVersion.split('.')[0], 10)
  const moduleVersionSuffix = majorVersion >= 2 ? `/v${majorVersion}` : ''
  const packageRef = opts.goModuleTemplate
    .replace('{publisher}', opts.publisher)
    .replace('{provider}', opts.provider)
    .replace('{moduleVersionSuffix}', moduleVersionSuffix)
  const packageVersionRef = `${packageRef}@${opts.packageVersion}`
  const addCmd = `go mod edit -require=${packageVersionRef}`
  core.debug(`Installing go package: ${addCmd}`)
  const addExec = shell.exec(addCmd, { cwd, fatal: true })
  if (addExec.code !== 0) {
    throw new Error(
      `Failed to install ${packageVersionRef}: \n${addExec.stderr}\n${addExec.stdout}`
    )
  }

  const modCmd = `go mod tidy`
  core.debug(`Tidying go modules: ${modCmd}`)
  const modExec = shell.exec(modCmd, { cwd, fatal: true })
  if (modExec.code !== 0) {
    throw new Error(
      `Failed to tidy go modules: \n${modExec.stderr}\n${modExec.stdout}`
    )
  }
}

function buildBackendPath(tempDir: string): string {
  // Check if we're running on windows
  if (process.platform === 'win32') {
    return `file://${tempDir.replace(/\\/g, '//')}`
  }
  return `file://${tempDir}`
}
