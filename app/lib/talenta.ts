import crypto from "crypto";

const BASE_URL = "https://api.mekari.com";

export function generateHmacHeader(apiPath: string) {
  const username = process.env.HMAC_USERNAME_TALENTA!;
  const secret = process.env.HMAC_SECRET!;
  const date = new Date().toUTCString();
  const requestLine = `GET ${apiPath} HTTP/1.1`;
  const message = `date: ${date}\n${requestLine}`;
  const signature = crypto.createHmac("sha256", secret).update(message).digest("base64");
  const authHeader = `hmac username="${username}", algorithm="hmac-sha256", headers="date request-line", signature="${signature}"`;
  return { authHeader, date };
}

export async function talentaGet<T>(apiPath: string): Promise<T> {
  const { authHeader, date } = generateHmacHeader(apiPath);
  const res = await fetch(BASE_URL + apiPath, {
    method: "GET",
    headers: {
      Authorization: authHeader,
      Date: date,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return JSON.parse(text) as T;
}
