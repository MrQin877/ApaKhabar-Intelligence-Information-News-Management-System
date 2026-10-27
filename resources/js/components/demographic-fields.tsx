import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export type Demographics = {
    date_of_birth?: string | null;
    citizenship?: string | null;
    gender?: string | null;
    ethnicity?: string | null;
};
export default function DemographicFields({
    values = {},
    errors,
}: {
    values?: Demographics;
    errors: Record<string, string>;
}) {
    return (
        <fieldset className="space-y-4 rounded-lg border p-4">
            <legend className="px-2 font-medium">Informasi warga</legend>
            <p className="text-sm text-muted-foreground">
                Tanggal lahir dan kewarganegaraan diperlukan untuk statistik
                warga terdaftar. Data ditampilkan sebagai ringkasan, bukan
                profil publik.
            </p>
            <div className="grid gap-2">
                <Label htmlFor="date_of_birth">Tanggal lahir *</Label>
                <Input
                    id="date_of_birth"
                    name="date_of_birth"
                    type="date"
                    required
                    defaultValue={values.date_of_birth ?? ''}
                    autoComplete="bday"
                />
                <InputError message={errors.date_of_birth} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="citizenship">Kewarganegaraan *</Label>
                <select
                    className="h-10 rounded-md border bg-background px-3"
                    id="citizenship"
                    name="citizenship"
                    required
                    defaultValue={values.citizenship ?? ''}
                >
                    <option value="" disabled>
                        Pilih kewarganegaraan
                    </option>
                    <option value="wni">WNI — Warga Negara Indonesia</option>
                    <option value="wna">WNA — Warga Negara Asing</option>
                    <option value="dual">Dua Kewarganegaraan</option>
                </select>
                <InputError message={errors.citizenship} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="gender">Jenis kelamin (opsional)</Label>
                <select
                    className="h-10 rounded-md border bg-background px-3"
                    id="gender"
                    name="gender"
                    defaultValue={values.gender ?? ''}
                >
                    <option value="">Belum mengisi</option>
                    <option value="male">Laki-laki</option>
                    <option value="female">Perempuan</option>
                    <option value="undisclosed">Tidak ingin menyebutkan</option>
                </select>
                <InputError message={errors.gender} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="ethnicity">Suku / Etnis (opsional)</Label>
                <Input
                    id="ethnicity"
                    name="ethnicity"
                    maxLength={100}
                    defaultValue={values.ethnicity ?? ''}
                    placeholder="Boleh dikosongkan"
                />
                <InputError message={errors.ethnicity} />
            </div>
        </fieldset>
    );
}
