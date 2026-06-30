export async function uploadToNextcloud(arrayBuffer: ArrayBuffer, filename: string): Promise<string> {
  const user = process.env.NEXTCLOUD_USER!;
  const pass = process.env.NEXTCLOUD_PASS!;
  const base = process.env.NEXTCLOUD_URL ?? "https://drive.euromedicagroup.co.id";

  const remotePath = `ssd/${filename}`;
  const url = `${base}/remote.php/dav/files/${user}/${remotePath}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
      "Content-Type": "application/octet-stream",
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: arrayBuffer as any,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Nextcloud upload gagal (${res.status}): ${text}`);
  }

  return remotePath;
}

export function nextcloudDownloadUrl(path: string): string {
  const user = process.env.NEXTCLOUD_USER!;
  const base = process.env.NEXTCLOUD_URL ?? "https://drive.euromedicagroup.co.id";
  return `${base}/remote.php/dav/files/${user}/${path}`;
}
