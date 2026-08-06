import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { AppModule } from './../src/app.module';

const KEY = randomBytes(32);

function encrypt(plaintext: string): {
  iv: string;
  authTag: string;
  data: string;
} {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return {
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64'),
  };
}

const keyFingerprint = createHash('sha256').update(KEY).digest('hex');

interface AuthBody {
  accessToken: string;
}

interface VaultBody {
  id: string;
  ownerId: string;
}

interface VersionEnvelope {
  version: {
    versionNo: number;
    data: string;
  };
  file: {
    id: string;
    currentVersionNo: number;
  };
}

interface FileListItem {
  path: string;
}

interface VersionMeta {
  versionNo: number;
}

describe('Shipi API (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let token: string;
  let vaultId: string;
  let fileId: string;
  const email = `e2e-${Date.now()}@test.dev`;
  const password = 'password123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    server = app.getHttpServer();

    const register = await request(server)
      .post('/auth/register')
      .send({ email, password })
      .expect(201);
    token = (register.body as AuthBody).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a vault', async () => {
    const res = await request(server)
      .post('/vaults')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Vault', keyFingerprint })
      .expect(201);
    vaultId = (res.body as VaultBody).id;
    expect((res.body as VaultBody).ownerId).toBeTruthy();
  });

  it('rejects a malformed key fingerprint', async () => {
    await request(server)
      .post('/vaults')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad Vault', keyFingerprint: 'not-a-hash' })
      .expect(400);
  });

  it('uploads an encrypted file as version 1', async () => {
    const blob = encrypt('# Welcome\n\nHello shipi.');
    const res = await request(server)
      .put(`/vaults/${vaultId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .send({ path: 'Notes/Welcome.md', baseVersion: 0, ...blob })
      .expect(200);

    const body = res.body as VersionEnvelope;
    expect(body.version.versionNo).toBe(1);
    expect(body.file.currentVersionNo).toBe(1);
    fileId = body.file.id;
  });

  it('uploads version 2 on top of baseVersion 1', async () => {
    const blob = encrypt('# Welcome\n\nHello shipi. v2');
    const res = await request(server)
      .put(`/vaults/${vaultId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .send({ path: 'Notes/Welcome.md', baseVersion: 1, ...blob })
      .expect(200);
    expect((res.body as VersionEnvelope).version.versionNo).toBe(2);
  });

  it('returns 409 on a stale baseVersion', async () => {
    const blob = encrypt('# Stale');
    await request(server)
      .put(`/vaults/${vaultId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .send({ path: 'Notes/Welcome.md', baseVersion: 1, ...blob })
      .expect(409);
  });

  it('lists files without leaking content', async () => {
    const res = await request(server)
      .get(`/vaults/${vaultId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = res.body as FileListItem[];
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ path: 'Notes/Welcome.md' });
    expect(body[0]).not.toHaveProperty('version');
  });

  it('lists version history', async () => {
    const res = await request(server)
      .get(`/vaults/${vaultId}/files/${fileId}/versions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = res.body as VersionMeta[];
    expect(body.map((v) => v.versionNo)).toEqual([2, 1]);
  });

  it('restores version 1 non-destructively as version 3', async () => {
    const v1 = await request(server)
      .get(`/vaults/${vaultId}/files/${fileId}/versions/1`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const v1Data = (v1.body as VersionEnvelope).version.data;

    const res = await request(server)
      .post(`/vaults/${vaultId}/files/${fileId}/restore/1`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const body = res.body as VersionEnvelope;

    expect(body.version.versionNo).toBe(3);
    expect(body.version.data).toBe(v1Data);

    const latest = await request(server)
      .get(`/vaults/${vaultId}/files/${fileId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((latest.body as VersionEnvelope).version.data).toBe(v1Data);
  });

  it('rejects a non-16-byte iv', async () => {
    await request(server)
      .put(`/vaults/${vaultId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        path: 'Bad.md',
        baseVersion: 0,
        iv: 'c2hvcnQ=',
        authTag: 'AAAAAAAAAAAAAAAAAAAAAAAA',
        data: 'AAAA',
      })
      .expect(400);
  });

  it('denies access to another user', async () => {
    const other = await request(server)
      .post('/auth/register')
      .send({ email: `other-${Date.now()}@test.dev`, password })
      .expect(201);
    const otherToken = (other.body as AuthBody).accessToken;

    await request(server)
      .get(`/vaults/${vaultId}/files`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });
});
