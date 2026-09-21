function authHeader(): string {
  const user = process.env.NEXTCLOUD_USER!;
  const pass = process.env.NEXTCLOUD_PASS!;
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

// WebDAV PUT tidak otomatis membuat parent folder — folder harus di-MKCOL dulu.
// Idempotent: 201 = dibuat, 405/409 = sudah ada, dianggap sukses.
export async function createFolderIfNotExists(folderPath: string): Promise<void> {
  const user = process.env.NEXTCLOUD_USER!;
  const base = process.env.NEXTCLOUD_URL ?? "https://drive.euromedicagroup.co.id";
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
  const base = process.env.NEXTCLOUD_URL ?? "https://drive.euromedicagroup.co.id";

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
  const base = process.env.NEXTCLOUD_URL ?? "https://drive.euromedicagroup.co.id";
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

export function nextcloudDownloadUrl(path: string): string {
  const user = process.env.NEXTCLOUD_USER!;
  const base = process.env.NEXTCLOUD_URL ?? "https://drive.euromedicagroup.co.id";
  return `${base}/remote.php/dav/files/${user}/${path}`;
}

// Fetches a file's raw content from Nextcloud (with Basic Auth) for server-side proxying —
// the browser can't hit Nextcloud directly since it requires credentials the client
// shouldn't hold. Caller is responsible for validating `path` before calling this (e.g.
// restricting to its own app's folder prefix, rejecting ".."/"//").
export async function fetchFromNextcloud(path: string): Promise<Response> {
  return fetch(nextcloudDownloadUrl(path), { headers: { Authorization: authHeader() } });
}

export async function deleteFromNextcloud(path: string): Promise<void> {
  const user = process.env.NEXTCLOUD_USER;
  const pass = process.env.NEXTCLOUD_PASS;
  const base = process.env.NEXTCLOUD_URL ?? "https://drive.euromedicagroup.co.id";
  if (!user || !pass) throw new Error("Nextcloud belum dikonfigurasi");
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
