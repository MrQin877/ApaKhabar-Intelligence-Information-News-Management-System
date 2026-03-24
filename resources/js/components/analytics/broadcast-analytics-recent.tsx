import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function AnalyticsRecent() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Siaran Terbaru</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-2">
          <Badge variant="destructive" className="shrink-0 rounded text-xs">
            MARA
          </Badge>
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Peringatan Cuaca Buruk</p>
            <p className="text-xs text-muted-foreground line-clamp-2">
              Badai dahsyat diperkirakan akan mempengaruhi daerah pesisir dalam
              24 jam ke depan. Pengguna diimbau untuk tetap waspada dan mengikuti
              pembaruan cuaca.
            </p>
            <p className="text-xs text-muted-foreground pt-1">
              Dikirim 09:10 ke Semua Pengguna ·{" "}
              <span className="text-green-500">1.282 dibuka 75%</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}