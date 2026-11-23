// worker/lib/b2.js — Backblaze B2 عبر aws4fetch (بدون AWS SDK)
import { AwsClient } from 'aws4fetch';

function b2(env) {
  const host = String(env.B2_ENDPOINT || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  if (!/^s3\.[a-z0-9-]+\.backblazeb2\.com$/.test(host)) {
    throw new Error('B2_ENDPOINT غلط: ' + host);
  }
  const region = host.split('.')[1];
  const client = new AwsClient({
    accessKeyId: env.B2_KEY_ID,
    secretAccessKey: env.B2_APP_KEY,
    service: 's3',
    region,
  });
  const base = `https://${host}/${env.B2_BUCKET || 'mowakkil'}`;
  return { client, base };
}

const enc = (k) => k.split('/').map(encodeURIComponent).join('/');

export async function b2Put(env, key, body, contentType) {
  const { client, base } = b2(env);
  const res = await client.fetch(`${base}/${enc(key)}`, {
    method: 'PUT',
    body, // ArrayBuffer
    headers: { 'Content-Type': contentType || 'application/octet-stream' },
  });
  if (!res.ok) throw new Error(`B2 PUT ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function b2Get(env, key) {
  const { client, base } = b2(env);
  return client.fetch(`${base}/${enc(key)}`, { method: 'GET' });
}

export async function b2Delete(env, key) {
  const { client, base } = b2(env);
  const res = await client.fetch(`${base}/${enc(key)}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`B2 DELETE ${res.status}`);
}