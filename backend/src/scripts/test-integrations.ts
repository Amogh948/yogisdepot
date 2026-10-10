import { env } from "../config/env";
import { SquareProvider } from "../services/payments/square.provider";
import { CloudinaryStorageProvider } from "../services/storage/cloudinary.provider";

const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<unreadable body>";
  }
}

async function testCloudinaryProvider(): Promise<{ publicId: string; url: string }> {
  assert(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET, "Cloudinary credentials are missing");
  const provider = new CloudinaryStorageProvider();
  const uploaded = await provider.save({
    buffer: PIXEL_PNG,
    mimetype: "image/png",
    originalname: "cloudinary-probe.png",
  } as Express.Multer.File);

  assert(uploaded.publicId, "Cloudinary upload did not return a publicId");
  assert(uploaded.url.includes("res.cloudinary.com"), `Unexpected Cloudinary URL host: ${uploaded.url}`);

  const retrieved = await provider.retrieve(uploaded.publicId);
  assert(retrieved.publicId === uploaded.publicId, "Retrieved publicId did not match the upload");
  assert(retrieved.bytes > 0, "Retrieved Cloudinary resource reported 0 bytes");
  assert(retrieved.url.includes("res.cloudinary.com"), "Retrieved URL was not a Cloudinary asset");

  const asset = await fetch(retrieved.url);
  assert(asset.ok, `Fetching the Cloudinary asset failed with HTTP ${asset.status}`);
  const body = Buffer.from(await asset.arrayBuffer());
  assert(body.length > 0, "Downloaded Cloudinary asset was empty");

  await provider.remove(uploaded.publicId);
  console.log("Cloudinary provider: upload, retrieve, and download succeeded");
  console.log(`  publicId=${retrieved.publicId} bytes=${retrieved.bytes} format=${retrieved.format}`);
  return uploaded;
}

async function testCloudinaryHttpApi(): Promise<void> {
  const base = `http://127.0.0.1:${env.PORT}`;
  const health = await fetch(`${base}/health`).catch(() => null);
  if (!health?.ok) {
    console.log("Cloudinary HTTP API: skipped (API is not running)");
    return;
  }

  const login = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "customer@yogisdepot.local", password: "Password@123" }),
  });
  if (!login.ok) {
    throw new Error(`Login for upload test failed: ${login.status} ${await readErrorBody(login)}`);
  }
  const cookie = login.headers.getSetCookie?.().find((value) => value.startsWith("yd_token=")) || login.headers.get("set-cookie") || "";
  assert(cookie.includes("yd_token="), "Login did not set an auth cookie");
  const tokenCookie = cookie.split(";")[0];

  const form = new FormData();
  form.append("files", new Blob([PIXEL_PNG], { type: "image/png" }), "cloudinary-api-probe.png");
  const upload = await fetch(`${base}/api/v1/uploads`, {
    method: "POST",
    headers: { Cookie: tokenCookie },
    body: form,
  });
  if (!upload.ok) {
    throw new Error(`Authenticated Cloudinary upload failed: ${upload.status} ${await readErrorBody(upload)}`);
  }
  const uploadBody = (await upload.json()) as { data: Array<{ publicId: string; url: string }> };
  const file = uploadBody.data[0];
  assert(file?.publicId, "Upload API did not return a publicId");

  const retrieve = await fetch(`${base}/api/v1/uploads?publicId=${encodeURIComponent(file.publicId)}`, {
    headers: { Cookie: tokenCookie },
  });
  if (!retrieve.ok) {
    throw new Error(`Authenticated Cloudinary retrieve failed: ${retrieve.status} ${await readErrorBody(retrieve)}`);
  }
  const retrieveBody = (await retrieve.json()) as { data: { url: string; publicId: string; bytes: number } };
  assert(retrieveBody.data.publicId === file.publicId, "Retrieve API publicId mismatch");
  const asset = await fetch(retrieveBody.data.url);
  assert(asset.ok, `Fetching API-uploaded Cloudinary asset failed with HTTP ${asset.status}`);

  await new CloudinaryStorageProvider().remove(file.publicId);
  console.log("Cloudinary HTTP API: upload and retrieve succeeded");
}

async function testSquareCreatePaymentIntent(): Promise<void> {
  assert(
    env.SQUARE_APPLICATION_ID && env.SQUARE_ACCESS_TOKEN && env.SQUARE_LOCATION_ID,
    "Square credentials are missing",
  );
  const intent = await new SquareProvider().createPayment({
    orderNumber: `YD-TEST-${Date.now()}`,
    amount: 1.99,
    amountCents: 199,
    method: "square",
    customerId: "integration-test",
  });
  assert(intent.provider === "square", "Payment provider was not Square");
  assert(String(intent.reference).startsWith("sq_"), `Unexpected Square reference: ${intent.reference}`);
  assert(
    intent.clientPayload?.applicationId === env.SQUARE_APPLICATION_ID,
    "Square client payload is missing the application id",
  );
  assert(
    intent.clientPayload?.locationId === env.SQUARE_LOCATION_ID,
    "Square client payload is missing the location id",
  );
  assert(intent.clientPayload?.amountCents === 199, "Square amountCents mismatch");
  console.log("Square Payments: sandbox payment intent created");
  console.log(
    `  reference=${intent.reference} amountCents=${intent.clientPayload?.amountCents} env=${intent.clientPayload?.environment}`,
  );
}

async function main(): Promise<void> {
  await testCloudinaryProvider();
  await testCloudinaryHttpApi();
  await testSquareCreatePaymentIntent();
  console.log("All live credential checks passed");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Integration check failed: ${message}`);
  process.exit(1);
});
