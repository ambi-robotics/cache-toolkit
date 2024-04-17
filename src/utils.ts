import { CompressionMethod } from '@actions/cache/lib/internal/constants'
import * as utils from '@actions/cache/lib/internal/cacheUtils'
import * as minio from 'minio'
import yn from 'yn'

export interface ObjectStoreOptions {
  bucket?: string
  endPoint?: string
  port?: number
  accessKey?: string
  secretKey?: string
  sessionToken?: string
  region?: string
  useSSL?: boolean
}

export interface CacheEntry {
  item: minio.BucketItem
  key: string
}

/**
 * isFeatureAvailable to check the presence of Actions cache service
 *
 * @returns boolean return true if Actions cache service feature is available, otherwise false
 */
export function isFeatureAvailable(): boolean {
  return true
}

export async function findObject(
  mc: minio.Client,
  bucket: string,
  key: string,
  restoreKeys: string[],
  compressionMethod: CompressionMethod
): Promise<CacheEntry> {
  const exactMatch = await listObjects(mc, bucket, key)
  if (exactMatch.length) {
    return { item: exactMatch[0], key }
  }

  for (const restoreKey of restoreKeys) {
    const fn = utils.getCacheFileName(compressionMethod)
    let objects = await listObjects(mc, bucket, restoreKey)
    objects = objects.filter(o => o.name?.includes(fn))
    if (objects.length < 1) {
      continue
    }
    const sorted = objects.sort(
      (a, b) =>
        (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0)
    )
    return { item: sorted[0], key: restoreKey }
  }
  throw new Error('Cache item not found')
}

export async function listObjects(
  mc: minio.Client,
  bucket: string,
  prefix: string
): Promise<minio.BucketItem[]> {
  return new Promise((resolve, reject) => {
    const h = mc.listObjectsV2(bucket, prefix, true)
    const r: minio.BucketItem[] = []
    let resolved = false
    const timeout = setTimeout(() => {
      if (!resolved)
        reject(new Error('list objects got no result after 10 seconds'))
    }, 10000)
    h.on('data', obj => {
      r.push(obj)
    })
    h.on('error', e => {
      resolved = true
      reject(e)
      clearTimeout(timeout)
    })
    h.on('end', () => {
      resolved = true
      resolve(r)
      clearTimeout(timeout)
    })
  })
}

export function getClient(options: ObjectStoreOptions): minio.Client {
  return new minio.Client({
    endPoint:
      options.endPoint ??
      process.env['ALT_GHA_CACHE_ENDPOINT'] ??
      's3.amazon.aws',
    port: options.port ?? Number(process.env['ALT_GHA_CACHE_PORT']) ?? 9000,
    accessKey:
      options.accessKey ??
      process.env['ALT_GHA_CACHE_ACCESS_KEY'] ??
      process.env['AWS_ACCESS_KEY_ID'] ??
      '',
    secretKey:
      options.secretKey ??
      process.env['ALT_GHA_CACHE_SECRET_KEY'] ??
      process.env['AWS_SECRET_ACCESS_KEY'] ??
      '',
    sessionToken:
      options.sessionToken ??
      process.env['ALT_GHA_CACHE_SESSION_TOKEN'] ??
      process.env['AWS_SESSION_TOKEN'] ??
      '',
    region:
      options.region ??
      process.env['ALT_GHA_CACHE_REGION'] ??
      process.env['AWS_REGION'] ??
      '',
    useSSL: options.useSSL ?? yn(process.env['ALT_GHA_CACHE_USE_SSL']) ?? true
  })
}

export function getBucket(options: ObjectStoreOptions): string {
  return options.bucket ?? process.env['ALT_GHA_CACHE_BUCKET'] ?? ''
}

export function checkPaths(paths: string[]): void {
  if (!paths || paths.length === 0) {
    throw new ValidationError(
      `Path Validation Error: At least one directory or file path is required`
    )
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
    Object.setPrototypeOf(this, ValidationError.prototype)
  }
}

export function checkKey(key: string): void {
  if (key.length > 512) {
    throw new ValidationError(
      `Key Validation Error: ${key} cannot be larger than 512 characters.`
    )
  }
  const regex = /^[^,]*$/
  if (!regex.test(key)) {
    throw new ValidationError(
      `Key Validation Error: ${key} cannot contain commas.`
    )
  }
}
