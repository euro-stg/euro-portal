/**
 * Karyawan yang masih bekerja (2026-10-23): status active DAN belum lewat tanggal resign.
 * Status baru berubah jadi inactive saat sync Talenta berikutnya, dan user manual bisa punya
 * resignDate tanpa statusnya diubah — jadi resignDate dicek langsung, supaya karyawan yang
 * sudah keluar tidak ikut menerima email/notifikasi atau terpilih sebagai approver.
 * Fungsi (bukan konstanta) karena "sekarang" harus dihitung ulang tiap query.
 */
export const activeEmployeeWhere = () => ({
  status: "active",
  OR: [{ resignDate: null }, { resignDate: { gt: new Date() } }],
});
