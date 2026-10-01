// Primary Nextcloud base URL + OPSIONAL domain alternatif (2026-10-01) — kalau
// NEXTCLOUD_URL_ALTERNATIF diset, server ini (sama persis instance/datanya, cuma beda nama
// domain — dikonfirmasi user, BUKAN storage terpisah) dianggap punya 2 cara reach yang
// sama-sama valid, dan kita pilih yang sedang benar-benar hidup. Kalau alternatif TIDAK
// diset (default di semua environment lain, termasuk dev lokal), perilaku PERSIS seperti
// sebelum fitur ini ada — tidak ada health-check tambahan sama sekali, zero overhead.
const PRIMARY_BASE = process.env.NEXTCLOUD_URL ?? "https://drive.euromedicagroup.co.id";
const ALT_BASE = process.env.NEXTCLOUD_URL_ALTERNATIF || null;

const HEALTH_CHECK_TIMEOUT_MS = 4000;
const HEALTH_CACHE_TTL_MS = 60_000; // re-cek tiap 60 detik — cukup cepat untuk pulih dari
// downtime sementara, cukup jarang untuk tidak membebani setiap request dengan health-check.
let cachedBase: { url: string; ts: number } | null = null;

// status.php adalah endpoint bawaan Nextcloud yang publik TANPA auth, dirancang memang
// untuk load-balancer/health-check semacam ini — lebih murah dari PROPFIND ke WebDAV yang
// butuh Basic Auth.
async function isNextcloudReachable(base: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}/status.php`, { signal: controller.signal });
      return res.ok;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

/** Base URL Nextcloud yang akan dipakai SEKARANG — primary selama masih hidup, otomatis
 * pindah ke NEXTCLOUD_URL_ALTERNATIF kalau primary sedang down, di-cache 60 detik supaya
 * tiap operasi Nextcloud (upload/download/move/delete, lintas SSD/EU/E Document) tidak
 * masing-masing nge-ping status.php sendiri-sendiri. Kalau KEDUANYA down, tetap kembalikan
 * primary (perilaku sebelum fitur ini ada) — bukan melempar error di sini, biar error asli
 * (gagal connect) tetap muncul natural di operasi yang sebenarnya, dengan pesan yang sudah
 * ada di tiap fungsi di bawah. */
export async function getNextcloudBaseUrl(): Promise<string> {
  if (!ALT_BASE) return PRIMARY_BASE;

  if (cachedBase && Date.now() - cachedBase.ts < HEALTH_CACHE_TTL_MS) return cachedBase.url;

  // Cek primary & alternatif PARALEL (bukan berurutan) — kalau sequential, worst-case saat
  // KEDUANYA down jadi 2x HEALTH_CHECK_TIMEOUT_MS (request yang kena cache-miss nunggu
  // sampai 8 detik). Paralel menurunkan worst-case jadi cuma 1x timeout (~4 detik), dengan
  // ongkos: primary yang sehat pun tetap ikut ping alternatif sekali per 60 detik (murah,
  // 1 request /status.php tambahan, jauh lebih murah daripada nambah 4 detik ke request
  // user yang apes kena cache-miss pas kedua domain mati).
  const [primaryOk, altOk] = await Promise.all([isNextcloudReachable(PRIMARY_BASE), isNextcloudReachable(ALT_BASE)]);
  const chosen = primaryOk ? PRIMARY_BASE : altOk ? ALT_BASE : PRIMARY_BASE;

  if (chosen !== cachedBase?.url) {
    console.log(`[nextcloud] base URL aktif: ${chosen}${chosen === ALT_BASE ? " (alternatif — primary sedang down)" : ""}`);
  }
  cachedBase = { url: chosen, ts: Date.now() };
  return chosen;
}

function authHeader(): string {
  const user = process.env.NEXTCLOUD_USER!;
  const pass = process.env.NEXTCLOUD_PASS!;
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

// WebDAV PUT tidak otomatis membuat parent folder — folder harus di-MKCOL dulu.
// Idempotent: 201 = dibuat, 405/409 = sudah ada, dianggap sukses.
export async function createFolderIfNotExists(folderPath: string): Promise<void> {
  const user = process.env.NEXTCLOUD_USER!;
  const base = await getNextcloudBaseUrl();
  const url = `${base}/remote.php/dav/files/${user}/${folderPath}`;

  const res = await fetch(url, {
    method: "MKCOL",
    headers: { Authorization: authHeader() },
  });

  if (![201, 405, 409].includes(res.status)) {
    const text = await res.text().catch(() => "");
    throw new Error(`Nextcloud gagal membuat folder ${folderPath} (${res.status}): ${text}`);
  }
}

export async function uploadToNextcloud(data: ArrayBuffer | Uint8Array, filename: string, prefix: string = "ssd"): Promise<string> {
  const user = process.env.NEXTCLOUD_USER!;
  const pass = process.env.NEXTCLOUD_PASS!;
  const base = await getNextcloudBaseUrl();

  const remotePath = `${prefix}/${filename}`;
  const url = `${base}/remote.php/dav/files/${user}/${remotePath}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
      "Content-Type": "application/octet-stream",
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: data as any,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Nextcloud upload gagal (${res.status}): ${text}`);
  }

  return remotePath;
}

// WebDAV MOVE renames/relocates a file OR a whole directory in a single request — for a
// directory, Nextcloud moves everything nested inside it server-side, no need to move
// children one by one. Overwrite: "F" refuses if something already exists at `toPath`
// (caller should already have checked for name collisions before calling this).
export async function moveInNextcloud(fromPath: string, toPath: string): Promise<void> {
  const user = process.env.NEXTCLOUD_USER!;
  const base = await getNextcloudBaseUrl();
  const fromUrl = `${base}/remote.php/dav/files/${user}/${fromPath}`;
  const toUrl = `${base}/remote.php/dav/files/${user}/${toPath}`;

  const res = await fetch(fromUrl, {
    method: "MOVE",
    headers: { Authorization: authHeader(), Destination: toUrl, Overwrite: "F" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Nextcloud gagal memindahkan ${fromPath} -> ${toPath} (${res.status}): ${text}`);
  }
}

export async function nextcloudDownloadUrl(path: string): Promise<string> {
  const user = process.env.NEXTCLOUD_USER!;
  const base = await getNextcloudBaseUrl();
  return `${base}/remote.php/dav/files/${user}/${path}`;
}

// Fetches a file's raw content from Nextcloud (with Basic Auth) for server-side proxying —
// the browser can't hit Nextcloud directly since it requires credentials the client
// shouldn't hold. Caller is responsible for validating `path` before calling this (e.g.
// restricting to its own app's folder prefix, rejecting ".."/"//").
export async function fetchFromNextcloud(path: string): Promise<Response> {
  return fetch(await nextcloudDownloadUrl(path), { headers: { Authorization: authHeader() } });
}

export async function deleteFromNextcloud(path: string): Promise<void> {
  const user = process.env.NEXTCLOUD_USER;
  const pass = process.env.NEXTCLOUD_PASS;
  if (!user || !pass) throw new Error("Nextcloud belum dikonfigurasi");
  const base = await getNextcloudBaseUrl();
  const url = `${base}/remote.php/dav/files/${user}/${path}`;
  console.log("[nextcloud] DELETE", url);
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`Nextcloud delete gagal (${res.status}): ${text}`);
  }
}
