import crypto from 'node:crypto';

type TokenPayload = Readonly<{
  userId: string,
  issuedAt: string,
  expiresAt: string
}>;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort((left, right) => left.localeCompare(right))
      .reduce((accumulator: Record<string, unknown>, key) => {
        accumulator[key] = canonicalize((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }

  return value;
};

const toBase64Url = (input: string) => Buffer.from(input, 'utf8').toString('base64url');
const fromBase64Url = (input: string) => Buffer.from(input, 'base64url').toString('utf8');

const deterministicSerialize = (value: unknown) => JSON.stringify(canonicalize(value));

const signPayload = (serializedPayload: string, secret: string) => crypto
  .createHmac('sha256', secret)
  .update(serializedPayload)
  .digest('base64url');

export const issueToken = ({ userId, issuedAt, expiresAt, secret }: TokenPayload & { secret: string }) => {
  const payload = Object.freeze({ userId, issuedAt, expiresAt });
  const serializedPayload = deterministicSerialize(payload);
  const signature = signPayload(serializedPayload, secret);

  return `${toBase64Url(serializedPayload)}.${signature}`;
};

export const verifyToken = ({ token, secret }: { token: string, secret: string }): TokenPayload | null => {
  if (typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');

  if (!encodedPayload || !signature) {
    return null;
  }

  try {
    const serializedPayload = fromBase64Url(encodedPayload);
    const expectedSignature = signPayload(serializedPayload, secret);

    if (signature !== expectedSignature) {
      return null;
    }

    const parsed = JSON.parse(serializedPayload);

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const payload = parsed as Record<string, unknown>;
    if (typeof payload.userId !== 'string' || typeof payload.issuedAt !== 'string' || typeof payload.expiresAt !== 'string') {
      return null;
    }

    return Object.freeze({
      userId: payload.userId,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt
    });
  } catch {
    return null;
  }
};
