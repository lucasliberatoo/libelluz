import assert from "node:assert/strict";
import { presign, toAmzDate, uriEncode } from "./sigv4";

// Vetor oficial da AWS: "Example: Presigned URL" em
// https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
const r = presign({
  method: "GET",
  host: "examplebucket.s3.amazonaws.com",
  path: "/test.txt",
  region: "us-east-1",
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  amzDate: "20130524T000000Z",
  expires: 86400,
});

assert.equal(
  r.canonicalRequest,
  [
    "GET",
    "/test.txt",
    "X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host",
    "host:examplebucket.s3.amazonaws.com",
    "",
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n"),
);
assert.equal(
  r.stringToSign,
  "AWS4-HMAC-SHA256\n20130524T000000Z\n20130524/us-east-1/s3/aws4_request\n3bfa292879f6447bbcda7001decf97f4a54dc650c8942174ae0a9121cf58ad04",
);
assert.equal(r.signature, "aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
assert.equal(
  r.url,
  "https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404",
);

// Codificação de caminho: espaços, acentos e "/" preservada
assert.equal(uriEncode("/b/u 1/Apostila (1)ção.pdf", true), "/b/u%201/Apostila%20%281%29%C3%A7%C3%A3o.pdf");
assert.equal(toAmzDate(new Date("2013-05-24T00:00:00.000Z")), "20130524T000000Z");

console.log("sigv4 ok");
