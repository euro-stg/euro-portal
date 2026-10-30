// Dipanggil sekali saat server Next.js start (lihat node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/instrumentation.md). Menjalankan worker antrean email
// blast & jadwal sync Master Item — hanya di runtime Node.js; import dinamis supaya tidak ikut
// ter-bundle ke runtime Edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startEmailQueueWorker } = await import("./app/lib/email-queue");
    startEmailQueueWorker();
    const { startMasterItemScheduler } = await import("./app/lib/master-item-sync");
    startMasterItemScheduler();
  }
}
