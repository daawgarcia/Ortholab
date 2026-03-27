-- AlterTable: add unique constraint to totvsId on DentistInvoice
CREATE UNIQUE INDEX IF NOT EXISTS "DentistInvoice_totvsId_key" ON "DentistInvoice"("totvsId");
