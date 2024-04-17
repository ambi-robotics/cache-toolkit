import * as core from '@actions/core'
import * as utils from '@actions/cache/lib/internal/cacheUtils'
import * as path from 'path'
import { extractTar, listTar } from '@actions/cache/lib/internal/tar'
import { DownloadOptions } from '@actions/cache/lib/options'

import {
  ObjectStoreOptions,
  getClient,
  getBucket,
  checkPaths,
  checkKey,
  ValidationError,
  findObject
} from './utils'

/**
 * Restores cache from keys
 *
 * @param paths a list of file paths to restore from the cache
 * @param primaryKey an explicit key for restoring the cache
 * @param restoreKeys an optional ordered list of keys to use for restoring the cache if no cache hit occurred for key
 * @param options cache download options
 * @param enableCrossOsArchive an optional boolean enabled to restore on windows any cache created on any platform
 * @param objectStoreOptions object store access options
 * @returns string returns the key for the cache hit, otherwise returns undefined
 */
export async function restoreCache(
  paths: string[],
  primaryKey: string,
  restoreKeys?: string[],
  options?: DownloadOptions,
  enableCrossOsArchive = false, // eslint-disable-line @typescript-eslint/no-unused-vars
  objectStoreOptions?: ObjectStoreOptions
): Promise<string | undefined> {
  objectStoreOptions ??= {}
  checkPaths(paths)

  restoreKeys = restoreKeys || []
  const keys = [primaryKey, ...restoreKeys]

  core.debug('Resolved Keys:')
  core.debug(JSON.stringify(keys))

  if (keys.length > 10) {
    throw new ValidationError(
      `Key Validation Error: Keys are limited to a maximum of 10.`
    )
  }
  for (const key of keys) {
    checkKey(key)
  }

  const compressionMethod = await utils.getCompressionMethod()
  let archivePath = ''
  try {
    const mc = getClient(objectStoreOptions)
    const bucket = getBucket(objectStoreOptions)
    const entry = await findObject(
      mc,
      bucket,
      primaryKey,
      restoreKeys,
      compressionMethod
    )

    if (options?.lookupOnly) {
      core.info('Lookup only - skipping download')
      return entry.key
    }

    if (entry.item.name === undefined) {
      return undefined
    }

    archivePath = path.join(
      await utils.createTempDirectory(),
      utils.getCacheFileName(compressionMethod)
    )
    core.debug(`Archive Path: ${archivePath}`)
    core.debug(`Downloading object ${entry.item.name} from bucket ${bucket}`)
    await mc.fGetObject(bucket, entry.item.name, archivePath)

    if (core.isDebug()) {
      await listTar(archivePath, compressionMethod)
    }

    const archiveFileSize = utils.getArchiveFileSizeInBytes(archivePath)
    core.info(
      `Cache Size: ~${Math.round(
        archiveFileSize / (1024 * 1024)
      )} MB (${archiveFileSize} B)`
    )

    await extractTar(archivePath, compressionMethod)
    core.info('Cache restored successfully')

    return entry.key
  } catch (error) {
    const typedError = error as Error
    if (typedError.name === ValidationError.name) {
      throw error
    } else {
      // Supress all non-validation cache related errors because caching should be optional
      core.warning(`Failed to restore: ${(error as Error).message}`)
    }
  } finally {
    // Try to delete the archive to save space
    try {
      await utils.unlinkFile(archivePath)
    } catch (error) {
      core.debug(`Failed to delete archive: ${error}`)
    }
  }

  return undefined
}
