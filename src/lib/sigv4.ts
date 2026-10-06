import { createHash, createHmac } from "node:crypto";

/**
 * Assinatura AWS Signature Version 4 para URLs pré-assinadas (query string).
 * Função pura: sem rede e sem variáveis de ambiente. Serve para S3 e Cloudflare R2.
 * https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
 */

export type PresignInput = {
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  /** ex.: "examplebucket.s3.amazonaws.com" ou "<conta>.r2.cloudflarestorage.com" */
  host: string;
  /** caminho sem codificação, começando com "/" (ex.: "/bucket/pasta/arquivo.pdf") */
  path: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** "YYYYMMDDTHHMMSSZ" */
  amzDate: string;
  /** validade em segundos (1 a 604800) */
  expires: number;
  service?: string;
  /** parâmetros extras assinados (ex.: response-content-disposition) */
  query?: Record<string, string>;
};

/** Codificação URI exigida pelo SigV4 (RFC 3986: só A-Z a-z 0-9 - _ . ~ ficam). */
export function uriEncode(s: string, keepSlash = false) {
  const out = encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return keepSlash ? out.replace(/%2F/g, "/") : out;
}

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const hmac = (key: Buffer | string, s: string) => createHmac("sha256", key).update(s, "utf8").digest();

export function signingKey(secret: string, date: string, region: string, service: string) {
  return hmac(hmac(hmac(hmac("AWS4" + secret, date), region), service), "aws4_request");
}

/** Monta a URL pré-assinada. Retorna também as peças intermediárias (úteis nos testes). */
export function presign(i: PresignInput) {
  const service = i.service ?? "s3";
  const date = i.amzDate.slice(0, 8);
  const scope = `${date}/${i.region}/${service}/aws4_request`;
  const params: Record<string, string> = {
    ...i.query,
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${i.accessKeyId}/${scope}`,
    "X-Amz-Date": i.amzDate,
    "X-Amz-Expires": String(i.expires),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(params)
    .map((k) => [uriEncode(k), uriEncode(params[k])] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const canonicalPath = uriEncode(i.path, true);
  const canonicalRequest = [i.method, canonicalPath, canonicalQuery, `host:${i.host}`, "", "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", i.amzDate, scope, sha256(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(i.secretAccessKey, date, i.region, service)).update(stringToSign, "utf8").digest("hex");
  return {
    url: `https://${i.host}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`,
    canonicalRequest,
    stringToSign,
    signature,
  };
}

/** Date → "YYYYMMDDTHHMMSSZ" */
export const toAmzDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
